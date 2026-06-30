-- Batches — group a pharmacy's missings into a "paper" the rep takes to market.
-- Batches wrap shortage_requests (which gain batch_id); the existing status machine
-- and history are reused. Writes go through SECURITY DEFINER RPCs (like 0004), which
-- enforce role/tenant rules explicitly. Helpers (is_super_admin, is_active_user,
-- app_company_id, app_role, app_pharmacy_id, rep_serves_pharmacy) come from 0002.

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id),
  status text not null default 'open' check (status in ('open','in_market','closed')),
  created_by uuid not null references public.profiles(id),
  taken_by uuid references public.profiles(id),
  taken_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- one OPEN batch per pharmacy (the find-or-create in create_shortage_request relies on this)
create unique index batches_one_open_per_pharmacy on public.batches(pharmacy_id) where status = 'open';
create index batches_company_idx on public.batches(company_id);
create index batches_pharmacy_status_idx on public.batches(pharmacy_id, status);

create trigger batches_set_updated_at before update on public.batches
  for each row execute function public.set_updated_at();

alter table public.shortage_requests add column batch_id uuid references public.batches(id);
create index shortage_requests_batch_idx on public.shortage_requests(batch_id);

-- ---------------------------------------------------------------------------
-- RLS: read scoped like shortage_requests (0003). Writes only via the RPCs below.
-- ---------------------------------------------------------------------------
alter table public.batches enable row level security;

create policy batches_select on public.batches
  for select to authenticated
  using (
    is_super_admin()
    or (
      is_active_user() and company_id = app_company_id() and (
        app_role() = 'company_admin'
        or (app_role() = 'pharmacist' and pharmacy_id = app_pharmacy_id())
        or (app_role() = 'sales_rep' and rep_serves_pharmacy(pharmacy_id))
      )
    )
  );

-- ---------------------------------------------------------------------------
-- create_shortage_request — now also files the request into the pharmacy's open
-- batch (find-or-create). Signature unchanged, so the app's create flow is untouched.
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

  -- auto-assign only when exactly one active assignment exists (DECISIONS/004)
  select count(*) into v_assignment_count
  from public.sales_rep_assignments
  where pharmacy_id = p_pharmacy_id and is_active;
  if v_assignment_count = 1 then
    select sales_rep_id into v_assigned
    from public.sales_rep_assignments
    where pharmacy_id = p_pharmacy_id and is_active;
  end if;

  -- find-or-create the pharmacy's open batch. Advisory lock so two concurrent
  -- pharmacists don't both create one and trip batches_one_open_per_pharmacy.
  -- ponytail: per-pharmacy advisory lock, cheap and correct.
  perform pg_advisory_xact_lock(hashtextextended(p_pharmacy_id::text, 0));
  select id into v_batch_id from public.batches
    where pharmacy_id = p_pharmacy_id and status = 'open' limit 1;
  if v_batch_id is null then
    insert into public.batches (company_id, pharmacy_id, status, created_by)
    values (v_company, p_pharmacy_id, 'open', auth.uid())
    returning id into v_batch_id;
  end if;

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

  return v_request_id;
end;
$$;

revoke execute on function public.create_shortage_request(uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.create_shortage_request(uuid, uuid, numeric, text, text) to authenticated;

-- Shared guard: caller may act on a batch's pharmacy (admin tenant-wide, rep if serving).
create or replace function public.can_handle_pharmacy(p_company uuid, p_pharmacy uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_role text; v_company uuid; v_active boolean;
begin
  select role, company_id, is_active into v_role, v_company, v_active
  from public.profiles where id = auth.uid();
  if v_role is null or not v_active then return false; end if;
  return v_role = 'super_admin'
      or (v_role = 'company_admin' and p_company = v_company)
      or (v_role = 'sales_rep' and p_company = v_company and rep_serves_pharmacy(p_pharmacy));
end;
$$;

-- ---------------------------------------------------------------------------
-- take_batch — rep/admin takes the open batch to market: batch -> in_market,
-- its missing items -> in_purchase (each with a history row).
-- ---------------------------------------------------------------------------
create or replace function public.take_batch(p_batch_id uuid)
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
  if b.status <> 'open' then
    raise exception 'batch is % not open', b.status using errcode = '55000';
  end if;

  update public.batches set status = 'in_market', taken_by = auth.uid(), taken_at = now()
  where id = p_batch_id;

  insert into public.shortage_status_history
    (shortage_request_id, company_id, old_status, new_status, changed_by, note)
  select id, company_id, 'missing', 'in_purchase', auth.uid(), 'أخذ الدفعة إلى السوق'
  from public.shortage_requests where batch_id = p_batch_id and status = 'missing';

  update public.shortage_requests set status = 'in_purchase'
  where batch_id = p_batch_id and status = 'missing';
end;
$$;
revoke execute on function public.take_batch(uuid) from public, anon;
grant execute on function public.take_batch(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_batch_item_purchased — rep/admin ticks an item bought (in_purchase->fulfilled)
-- or un-ticks (fulfilled->in_purchase, no note needed). Auto-closes the batch when
-- nothing is left to buy; un-ticking the last reopens it to in_market.
-- ---------------------------------------------------------------------------
create or replace function public.set_batch_item_purchased(p_request_id uuid, p_purchased boolean)
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
  set status = v_new, fulfilled_at = case when v_new = 'fulfilled' then now() else null end
  where id = p_request_id;

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
revoke execute on function public.set_batch_item_purchased(uuid, boolean) from public, anon;
grant execute on function public.set_batch_item_purchased(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- split_batch — rep/admin moves the given items of an in-market batch onto a new
-- in-market batch (a separate "paper"). Returns the new batch id. New batch is
-- in_market so it never collides with batches_one_open_per_pharmacy.
-- ---------------------------------------------------------------------------
create or replace function public.split_batch(p_batch_id uuid, p_request_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare b public.batches%rowtype; v_new uuid; v_match int; v_n int;
begin
  select * into b from public.batches where id = p_batch_id for update;
  if b.id is null then raise exception 'batch not found' using errcode = 'P0002'; end if;
  if not public.can_handle_pharmacy(b.company_id, b.pharmacy_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if b.status <> 'in_market' then
    raise exception 'only an in-market batch can be split' using errcode = '22023';
  end if;

  v_n := coalesce(array_length(p_request_ids, 1), 0);
  if v_n = 0 then raise exception 'no items selected' using errcode = '22023'; end if;

  select count(*) into v_match from public.shortage_requests
  where id = any(p_request_ids) and batch_id = p_batch_id;
  if v_match <> v_n then
    raise exception 'some items are not in this batch' using errcode = '22023';
  end if;

  insert into public.batches (company_id, pharmacy_id, status, created_by, taken_by, taken_at)
  values (b.company_id, b.pharmacy_id, 'in_market', auth.uid(), auth.uid(), now())
  returning id into v_new;

  update public.shortage_requests set batch_id = v_new
  where id = any(p_request_ids) and batch_id = p_batch_id;

  return v_new;
end;
$$;
revoke execute on function public.split_batch(uuid, uuid[]) from public, anon;
grant execute on function public.split_batch(uuid, uuid[]) to authenticated;
