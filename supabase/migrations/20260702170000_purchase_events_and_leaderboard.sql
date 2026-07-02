-- Durable purchase attribution and transparent sales-rep performance metrics.

alter table public.shortage_requests
  add column purchase_started_at timestamptz,
  add column purchased_by uuid references public.profiles(id);
create index shortage_requests_purchased_by_idx
  on public.shortage_requests(purchased_by, fulfilled_at)
  where purchased_by is not null;

create table public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  shortage_request_id uuid not null references public.shortage_requests(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),
  purchase_source text,
  started_at timestamptz,
  purchased_at timestamptz not null default now(),
  reversed_at timestamptz,
  created_at timestamptz not null default now()
);
create index purchase_events_request_idx
  on public.purchase_events(shortage_request_id, purchased_at desc);
create index purchase_events_buyer_idx
  on public.purchase_events(buyer_id, purchased_at desc)
  where reversed_at is null;

alter table public.purchase_events enable row level security;
create policy purchase_events_select on public.purchase_events
  for select to authenticated
  using (
    exists (
      select 1 from public.shortage_requests r
      where r.id = shortage_request_id
    )
  );

-- Backfill every historical fulfillment from the immutable status history.
insert into public.purchase_events (
  shortage_request_id, batch_id, company_id, buyer_id,
  purchase_source, started_at, purchased_at
)
select
  h.shortage_request_id,
  r.batch_id,
  h.company_id,
  h.changed_by,
  r.purchase_source,
  (
    select h2.created_at
    from public.shortage_status_history h2
    where h2.shortage_request_id = h.shortage_request_id
      and h2.new_status = 'in_purchase'
      and h2.created_at <= h.created_at
    order by h2.created_at desc
    limit 1
  ),
  h.created_at
from public.shortage_status_history h
join public.shortage_requests r on r.id = h.shortage_request_id
where h.new_status = 'fulfilled';

update public.shortage_requests r
set purchased_by = (
      select pe.buyer_id from public.purchase_events pe
      where pe.shortage_request_id = r.id and pe.reversed_at is null
      order by pe.purchased_at desc limit 1
    ),
    purchase_started_at = (
      select pe.started_at from public.purchase_events pe
      where pe.shortage_request_id = r.id and pe.reversed_at is null
      order by pe.purchased_at desc limit 1
    )
where r.status = 'fulfilled'
  and exists (
    select 1 from public.purchase_events pe
    where pe.shortage_request_id = r.id and pe.reversed_at is null
  );

-- Start a purchasing run and stamp every item with the same clock/source.
create or replace function public.take_batch(
  p_batch_id uuid,
  p_purchase_source text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare b public.batches%rowtype; v_source text := nullif(trim(p_purchase_source), '');
begin
  if v_source is null or char_length(v_source) > 200 then
    raise exception 'invalid purchase source' using errcode = '22023';
  end if;
  select * into b from public.batches where id = p_batch_id for update;
  if b.id is null then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if not public.can_handle_pharmacy(b.company_id, b.pharmacy_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if b.status <> 'open' then
    raise exception 'batch is % not open', b.status using errcode = '55000';
  end if;

  update public.batches
  set status = 'in_market', taken_by = auth.uid(), taken_at = now(),
      default_purchase_source = v_source
  where id = p_batch_id;

  insert into public.shortage_status_history
    (shortage_request_id, company_id, old_status, new_status, changed_by, note)
  select id, company_id, 'missing', 'in_purchase', auth.uid(), 'أخذ الدفعة إلى السوق'
  from public.shortage_requests
  where batch_id = p_batch_id and status = 'missing';

  update public.shortage_requests
  set status = 'in_purchase',
      purchase_source = v_source,
      purchase_started_at = now(),
      purchased_by = null
  where batch_id = p_batch_id and status = 'missing';
end;
$$;

-- Record the actual actor, batch, source, and elapsed purchasing window.
create or replace function public.set_batch_item_purchased(
  p_request_id uuid,
  p_purchased boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.shortage_requests%rowtype;
  v_old text; v_new text; v_remaining int;
begin
  select * into r from public.shortage_requests where id = p_request_id for update;
  if r.id is null then raise exception 'request not found' using errcode = 'P0002'; end if;
  if r.batch_id is null then raise exception 'request not in a batch' using errcode = '22023'; end if;
  if not public.can_handle_pharmacy(r.company_id, r.pharmacy_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_purchased then
    if r.status <> 'in_purchase' then
      raise exception 'item is % not in_purchase', r.status using errcode = '55000'; end if;
    v_old := 'in_purchase'; v_new := 'fulfilled';
  else
    if r.status <> 'fulfilled' then
      raise exception 'item is % not fulfilled', r.status using errcode = '55000'; end if;
    v_old := 'fulfilled'; v_new := 'in_purchase';
  end if;

  update public.shortage_requests
  set status = v_new,
      fulfilled_at = case when p_purchased then now() else null end,
      purchased_by = case when p_purchased then auth.uid() else null end
  where id = p_request_id;

  if p_purchased then
    insert into public.purchase_events (
      shortage_request_id, batch_id, company_id, buyer_id,
      purchase_source, started_at, purchased_at
    )
    values (
      r.id, r.batch_id, r.company_id, auth.uid(),
      r.purchase_source, r.purchase_started_at, now()
    );
  else
    update public.purchase_events
    set reversed_at = now()
    where id = (
      select id from public.purchase_events
      where shortage_request_id = r.id and reversed_at is null
      order by purchased_at desc limit 1
    );
  end if;

  insert into public.shortage_status_history
    (shortage_request_id, company_id, old_status, new_status, changed_by, note)
  values (p_request_id, r.company_id, v_old, v_new, auth.uid(), null);

  select count(*) into v_remaining from public.shortage_requests
  where batch_id = r.batch_id and status in ('missing','in_purchase');
  if v_remaining = 0 then
    update public.batches set status = 'closed', closed_at = now()
    where id = r.batch_id and status <> 'closed';
  else
    update public.batches set status = 'in_market', closed_at = null
    where id = r.batch_id and status = 'closed';
  end if;
end;
$$;

-- A requeued item starts a new purchasing clock on its next batch run.
create or replace function public.requeue_not_found(p_request_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r public.shortage_requests%rowtype; v_batch uuid;
begin
  for r in
    select * from public.shortage_requests
    where id = any(p_request_ids) and status = 'not_found'
    for update
  loop
    if not public.can_handle_pharmacy(r.company_id, r.pharmacy_id) then
      raise exception 'not allowed' using errcode = '42501';
    end if;
    v_batch := public.get_or_create_open_batch(r.company_id, r.pharmacy_id);
    update public.shortage_requests
    set status = 'missing', batch_id = v_batch,
        purchase_started_at = null, purchased_by = null
    where id = r.id;
    insert into public.shortage_status_history
      (shortage_request_id, company_id, old_status, new_status, changed_by, note)
    values (r.id, r.company_id, 'not_found', 'missing', auth.uid(), 'إعادة طلب صنف غير متوفر');
  end loop;
end;
$$;

create or replace function public.rep_purchase_leaderboard(
  p_days int default 30,
  p_limit int default 20
)
returns table (
  rep_id uuid,
  full_name text,
  purchased_items bigint,
  batches_handled bigint,
  average_minutes numeric,
  fastest_minutes numeric,
  last_purchase_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select
    pe.buyer_id,
    p.full_name,
    count(*)::bigint,
    count(distinct pe.batch_id)::bigint,
    round(avg(extract(epoch from (pe.purchased_at - pe.started_at)) / 60.0), 1),
    round(min(extract(epoch from (pe.purchased_at - pe.started_at)) / 60.0), 1),
    max(pe.purchased_at)
  from public.purchase_events pe
  join public.profiles p on p.id = pe.buyer_id and p.role = 'sales_rep'
  where pe.reversed_at is null
    and pe.started_at is not null
    and (p_days is null or pe.purchased_at >= now() - make_interval(days => p_days))
  group by pe.buyer_id, p.full_name
  order by count(*) desc,
           avg(pe.purchased_at - pe.started_at) asc
  limit greatest(p_limit, 1);
$$;

revoke execute on function public.rep_purchase_leaderboard(int, int) from public, anon;
grant execute on function public.rep_purchase_leaderboard(int, int) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'purchase_events'
  ) then
    alter publication supabase_realtime add table public.purchase_events;
  end if;
end;
$$;
