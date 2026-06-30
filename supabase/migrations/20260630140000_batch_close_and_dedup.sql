-- Close batch (unavailable pool) + requester aggregation.
-- Adds the 'not_found' status, a per-(request,pharmacist) requesters table so demand is
-- counted instead of duplicated, and RPCs to close a batch (remaining -> not_found),
-- re-queue unavailable items, plus dedup-on-create. Builds on 0005 (batches).

-- New terminal-ish status for items the rep couldn't find in the market.
alter table public.shortage_requests drop constraint shortage_requests_status_check;
alter table public.shortage_requests add constraint shortage_requests_status_check
  check (status in ('missing','in_purchase','fulfilled','cancelled','not_found'));

-- One row per (request, pharmacist): keeps each pharmacist's request counted on a single entry.
create table public.shortage_request_requesters (
  id uuid primary key default gen_random_uuid(),
  shortage_request_id uuid not null references public.shortage_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (shortage_request_id, profile_id)
);
create index srr_request_idx on public.shortage_request_requesters(shortage_request_id);

alter table public.shortage_request_requesters enable row level security;
-- Visible whenever the parent request is visible (its own RLS is checked by the subquery).
create policy srr_select on public.shortage_request_requesters
  for select to authenticated
  using (
    is_super_admin()
    or exists (select 1 from public.shortage_requests r where r.id = shortage_request_id)
  );

-- Backfill: every existing request's original requester becomes a requester row.
insert into public.shortage_request_requesters (shortage_request_id, company_id, profile_id)
select id, company_id, requested_by from public.shortage_requests
on conflict (shortage_request_id, profile_id) do nothing;

-- ---------------------------------------------------------------------------
-- get_or_create_open_batch — advisory-locked find-or-create (was inlined in
-- create_shortage_request); reused by creation and re-queue. Not granted to
-- clients; only the SECURITY DEFINER callers below invoke it (as owner).
-- ---------------------------------------------------------------------------
create or replace function public.get_or_create_open_batch(p_company uuid, p_pharmacy uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_batch uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_pharmacy::text, 0));
  select id into v_batch from public.batches where pharmacy_id = p_pharmacy and status = 'open' limit 1;
  if v_batch is null then
    insert into public.batches (company_id, pharmacy_id, status, created_by)
    values (p_company, p_pharmacy, 'open', auth.uid())
    returning id into v_batch;
  end if;
  return v_batch;
end;
$$;
revoke execute on function public.get_or_create_open_batch(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_shortage_request — now dedups: if an active shortage for the same
-- (pharmacy,item) exists, just record the caller as another requester. Else
-- create the row (via the open batch) and seed its first requester.
-- ---------------------------------------------------------------------------
create or replace function public.create_shortage_request(
  p_pharmacy_id uuid,
  p_item_id uuid,
  p_quantity numeric default 1,
  p_priority text default 'normal',
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_caller_company uuid;
  v_caller_pharmacy uuid;
  v_active boolean;
  v_company uuid;
  v_item_company uuid;
  v_item_active boolean;
  v_assigned uuid;
  v_assignment_count int;
  v_existing uuid;
  v_batch_id uuid;
  v_request_id uuid;
begin
  select role, company_id, pharmacy_id, is_active
    into v_role, v_caller_company, v_caller_pharmacy, v_active
  from public.profiles where id = auth.uid();

  if v_role is null or not v_active then
    raise exception 'caller has no active profile' using errcode = '42501';
  end if;
  if v_role not in ('pharmacist', 'company_admin', 'super_admin') then
    raise exception 'role % may not create shortage requests', v_role using errcode = '42501';
  end if;

  select company_id into v_company from public.pharmacies where id = p_pharmacy_id and is_active;
  if v_company is null then
    raise exception 'pharmacy not found or inactive' using errcode = 'P0002';
  end if;

  if v_role <> 'super_admin' and v_company <> v_caller_company then
    raise exception 'pharmacy belongs to another company' using errcode = '42501';
  end if;
  if v_role = 'pharmacist' and p_pharmacy_id <> v_caller_pharmacy then
    raise exception 'pharmacist may only create for their own pharmacy' using errcode = '42501';
  end if;

  select company_id, is_active into v_item_company, v_item_active
  from public.items where id = p_item_id;
  if v_item_company is null or not v_item_active then
    raise exception 'item not found or inactive' using errcode = 'P0002';
  end if;
  if v_item_company <> v_company then
    raise exception 'item belongs to another company' using errcode = '42501';
  end if;

  -- dedup: an active shortage for this pharmacy+item already exists → just add the
  -- caller as another requester (preserve each pharmacist's effort) and return it.
  select id into v_existing from public.shortage_requests
  where pharmacy_id = p_pharmacy_id and item_id = p_item_id
    and status in ('missing', 'in_purchase', 'not_found')
  order by created_at desc
  limit 1;
  if v_existing is not null then
    insert into public.shortage_request_requesters (shortage_request_id, company_id, profile_id)
    values (v_existing, v_company, auth.uid())
    on conflict (shortage_request_id, profile_id) do nothing;
    return v_existing;
  end if;

  -- auto-assign only when exactly one active assignment exists (DECISIONS/004)
  select count(*) into v_assignment_count
  from public.sales_rep_assignments
  where pharmacy_id = p_pharmacy_id and is_active;
  if v_assignment_count = 1 then
    select sales_rep_id into v_assigned
    from public.sales_rep_assignments
    where pharmacy_id = p_pharmacy_id and is_active;
  end if;

  v_batch_id := public.get_or_create_open_batch(v_company, p_pharmacy_id);

  insert into public.shortage_requests
    (company_id, pharmacy_id, item_id, requested_by, assigned_to, quantity, priority, notes, status, batch_id)
  values
    (v_company, p_pharmacy_id, p_item_id, auth.uid(), v_assigned,
     coalesce(p_quantity, 1), coalesce(p_priority, 'normal'), p_notes, 'missing', v_batch_id)
  returning id into v_request_id;

  insert into public.shortage_status_history
    (shortage_request_id, company_id, old_status, new_status, changed_by, note)
  values
    (v_request_id, v_company, null, 'missing', auth.uid(), p_notes);

  insert into public.shortage_request_requesters (shortage_request_id, company_id, profile_id)
  values (v_request_id, v_company, auth.uid())
  on conflict (shortage_request_id, profile_id) do nothing;

  return v_request_id;
end;
$$;

revoke execute on function public.create_shortage_request(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.create_shortage_request(uuid, uuid, numeric, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- close_batch — rep/admin closes an in-market batch; unbought (in_purchase)
-- items become not_found (the unavailable pool). Fulfilled items stay.
-- ---------------------------------------------------------------------------
create or replace function public.close_batch(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare b public.batches%rowtype;
begin
  select * into b from public.batches where id = p_batch_id for update;
  if b.id is null then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if not public.can_handle_pharmacy(b.company_id, b.pharmacy_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if b.status <> 'in_market' then
    raise exception 'batch is % not in_market', b.status using errcode = '55000';
  end if;

  insert into public.shortage_status_history
    (shortage_request_id, company_id, old_status, new_status, changed_by, note)
  select id, company_id, 'in_purchase', 'not_found', auth.uid(), 'إغلاق الدفعة: غير متوفر بالسوق'
  from public.shortage_requests where batch_id = p_batch_id and status = 'in_purchase';

  update public.shortage_requests set status = 'not_found'
  where batch_id = p_batch_id and status = 'in_purchase';

  update public.batches set status = 'closed', closed_at = now() where id = p_batch_id;
end;
$$;
revoke execute on function public.close_batch(uuid) from public, anon;
grant execute on function public.close_batch(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- requeue_not_found — rep/admin sends unavailable items back to missing inside
-- their pharmacy's open batch (find-or-create), so a new run can pick them up.
-- ---------------------------------------------------------------------------
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
    update public.shortage_requests set status = 'missing', batch_id = v_batch where id = r.id;
    insert into public.shortage_status_history
      (shortage_request_id, company_id, old_status, new_status, changed_by, note)
    values (r.id, r.company_id, 'not_found', 'missing', auth.uid(), 'إعادة طلب صنف غير متوفر');
  end loop;
end;
$$;
revoke execute on function public.requeue_not_found(uuid[]) from public, anon;
grant execute on function public.requeue_not_found(uuid[]) to authenticated;
