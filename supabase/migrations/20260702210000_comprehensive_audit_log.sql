-- Immutable, tenant-scoped audit ledger for all application data changes.

create table public.audit_events (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete set null,
  actor_id uuid,
  actor_name text,
  actor_role text,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  action text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_events_company_created_idx
  on public.audit_events(company_id, created_at desc);
create index audit_events_actor_created_idx
  on public.audit_events(actor_id, created_at desc);
create index audit_events_type_created_idx
  on public.audit_events(event_type, created_at desc);

alter table public.audit_events enable row level security;
create policy audit_events_admin_select on public.audit_events
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      public.is_active_user()
      and public.app_role() = 'company_admin'
      and company_id = public.app_company_id()
    )
  );

revoke all on table public.audit_events from public, anon, authenticated;
grant select on table public.audit_events to authenticated;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_company uuid;
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_actor_role text;
  v_action text := lower(tg_op);
  v_entity_id text;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
  else
    v_old := to_jsonb(old);
    v_row := v_old;
  end if;

  if tg_table_name = 'companies' then
    v_company := nullif(v_row ->> 'id', '')::uuid;
  else
    v_company := nullif(v_row ->> 'company_id', '')::uuid;
  end if;
  v_entity_id := coalesce(v_row ->> 'id', v_row ->> 'shortage_request_id');

  if v_actor is not null then
    select p.full_name, p.role, coalesce(v_company, p.company_id)
      into v_actor_name, v_actor_role, v_company
    from public.profiles p
    where p.id = v_actor;
  end if;

  insert into public.audit_events (
    company_id, actor_id, actor_name, actor_role, event_type,
    entity_type, entity_id, action, summary, details
  )
  values (
    v_company, v_actor, v_actor_name, v_actor_role, 'data.' || v_action,
    tg_table_name, v_entity_id, v_action,
    tg_table_name || '.' || v_action,
    jsonb_strip_nulls(jsonb_build_object('before', v_old, 'after', v_new))
  );
  return coalesce(new, old);
exception when others then
  -- Auditing must never make the underlying business transaction unavailable.
  return coalesce(new, old);
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'companies', 'pharmacies', 'profiles', 'items', 'item_categories',
    'item_units', 'batches', 'shortage_requests',
    'shortage_request_requesters', 'shortage_status_history',
    'sales_rep_assignments', 'batch_attachments', 'purchase_events'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.audit_row_change()',
      v_table || '_audit_change', v_table
    );
  end loop;
end;
$$;

-- Explicit events cover authentication and operations performed through the
-- service role, where auth.uid() is otherwise unavailable to row triggers.
create or replace function public.record_audit_event(
  p_event_type text,
  p_entity_type text,
  p_action text,
  p_summary text,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb,
  p_company_id uuid default null,
  p_actor_id uuid default null,
  p_ip_address inet default null,
  p_user_agent text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), '');
  v_actor uuid := coalesce(auth.uid(), p_actor_id);
  v_company uuid := p_company_id;
  v_actor_name text;
  v_actor_role text;
  v_id bigint;
begin
  if v_role <> 'service_role' and auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_role <> 'service_role' and p_actor_id is not null and p_actor_id <> auth.uid() then
    raise exception 'invalid actor' using errcode = '42501';
  end if;

  if v_actor is not null then
    select p.full_name, p.role, coalesce(v_company, p.company_id)
      into v_actor_name, v_actor_role, v_company
    from public.profiles p where p.id = v_actor;
  end if;

  insert into public.audit_events (
    company_id, actor_id, actor_name, actor_role, event_type,
    entity_type, entity_id, action, summary, details, ip_address, user_agent
  )
  values (
    v_company, v_actor, v_actor_name, v_actor_role, left(p_event_type, 100),
    left(p_entity_type, 100), p_entity_id, left(p_action, 100),
    left(p_summary, 500), coalesce(p_details, '{}'::jsonb), p_ip_address,
    left(p_user_agent, 1000)
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.record_audit_event(
  text, text, text, text, text, jsonb, uuid, uuid, inet, text
) from public, anon;
grant execute on function public.record_audit_event(
  text, text, text, text, text, jsonb, uuid, uuid, inet, text
) to authenticated, service_role;

create or replace function public.admin_audit_report(
  p_search text default null,
  p_event_type text default null,
  p_actor_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id bigint,
  created_at timestamptz,
  event_type text,
  entity_type text,
  entity_id text,
  action text,
  summary text,
  actor_id uuid,
  actor_name text,
  actor_role text,
  details jsonb,
  ip_address inet,
  user_agent text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_company uuid;
  v_active boolean;
begin
  select p.role, p.company_id, p.is_active
    into v_role, v_company, v_active
  from public.profiles p where p.id = auth.uid();
  if not coalesce(v_active, false) or v_role not in ('company_admin', 'super_admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
    select e.id, e.created_at, e.event_type, e.entity_type, e.entity_id,
           e.action, e.summary, e.actor_id, e.actor_name, e.actor_role,
           e.details, e.ip_address, e.user_agent, count(*) over()
    from public.audit_events e
    where (v_role = 'super_admin' or e.company_id = v_company)
      and (p_event_type is null or e.event_type = p_event_type)
      and (p_actor_id is null or e.actor_id = p_actor_id)
      and (p_from is null or e.created_at >= p_from)
      and (p_to is null or e.created_at <= p_to)
      and (
        p_search is null or btrim(p_search) = ''
        or e.summary ilike '%' || btrim(p_search) || '%'
        or e.entity_type ilike '%' || btrim(p_search) || '%'
        or e.entity_id ilike '%' || btrim(p_search) || '%'
        or e.actor_name ilike '%' || btrim(p_search) || '%'
        or e.details::text ilike '%' || btrim(p_search) || '%'
      )
    order by e.created_at desc, e.id desc
    limit least(greatest(p_limit, 1), 10000)
    offset greatest(p_offset, 0);
end;
$$;
revoke execute on function public.admin_audit_report(
  text, text, uuid, timestamptz, timestamptz, int, int
) from public, anon;
grant execute on function public.admin_audit_report(
  text, text, uuid, timestamptz, timestamptz, int, int
) to authenticated;

-- Reconstruct the historical events already represented by durable records.
insert into public.audit_events (
  company_id, actor_id, actor_name, actor_role, event_type,
  entity_type, entity_id, action, summary, details, created_at
)
select r.company_id, r.requested_by, p.full_name, p.role, 'request.created',
       'shortage_requests', r.id::text, 'insert', 'shortage_requests.insert',
       jsonb_build_object('source', 'historical_backfill', 'after', to_jsonb(r)),
       r.created_at
from public.shortage_requests r
left join public.profiles p on p.id = r.requested_by;

insert into public.audit_events (
  company_id, actor_id, actor_name, actor_role, event_type,
  entity_type, entity_id, action, summary, details, created_at
)
select h.company_id, h.changed_by, p.full_name, p.role, 'request.status_changed',
       'shortage_status_history', h.id::text, 'insert', 'shortage status changed',
       jsonb_build_object('source', 'historical_backfill', 'after', to_jsonb(h)),
       h.created_at
from public.shortage_status_history h
left join public.profiles p on p.id = h.changed_by;

insert into public.audit_events (
  company_id, actor_id, actor_name, actor_role, event_type,
  entity_type, entity_id, action, summary, details, created_at
)
select pe.company_id, pe.buyer_id, p.full_name, p.role, 'purchase.completed',
       'purchase_events', pe.id::text, 'insert', 'purchase completed',
       jsonb_build_object('source', 'historical_backfill', 'after', to_jsonb(pe)),
       pe.purchased_at
from public.purchase_events pe
left join public.profiles p on p.id = pe.buyer_id;

insert into public.audit_events (
  company_id, actor_id, actor_name, actor_role, event_type,
  entity_type, entity_id, action, summary, details, created_at
)
select a.company_id, a.uploaded_by, p.full_name, p.role, 'attachment.added',
       'batch_attachments', a.id::text, 'insert', 'batch attachment added',
       jsonb_build_object('source', 'historical_backfill', 'after', to_jsonb(a)),
       a.created_at
from public.batch_attachments a
left join public.profiles p on p.id = a.uploaded_by;
