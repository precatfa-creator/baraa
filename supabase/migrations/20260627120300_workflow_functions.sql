-- Phase 2 / 0004 — Workflow functions. SECURITY DEFINER: they bypass RLS and instead
-- enforce role/tenant rules explicitly, so all status changes route through one audited
-- path (DECISIONS/004, ARCHITECTURE §8). Permission matrix: docs/PERMISSIONS.md §5.

-- Create a shortage request (status 'missing') and its initial history row.
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

  -- tenant + pharmacy scoping
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

  insert into public.shortage_requests
    (company_id, pharmacy_id, item_id, requested_by, assigned_to, quantity, priority, notes, status)
  values
    (v_company, p_pharmacy_id, p_item_id, auth.uid(), v_assigned,
     coalesce(p_quantity, 1), coalesce(p_priority, 'normal'), p_notes, 'missing')
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

-- Move a request between statuses. Guarded compare-and-set under a row lock so a
-- concurrent transition fails cleanly instead of double-applying.
create or replace function public.transition_shortage_status(
  p_request_id uuid,
  p_expected_status text,
  p_new_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_caller_company uuid;
  v_caller_pharmacy uuid;
  v_active boolean;
  r public.shortage_requests%rowtype;
  v_edge text := p_expected_status || '->' || p_new_status;
  v_allowed boolean := false;
begin
  select role, company_id, pharmacy_id, is_active
    into v_role, v_caller_company, v_caller_pharmacy, v_active
  from public.profiles where id = auth.uid();

  if v_role is null or not v_active then
    raise exception 'caller has no active profile' using errcode = '42501';
  end if;

  select * into r from public.shortage_requests where id = p_request_id for update;
  if r.id is null then
    raise exception 'request not found' using errcode = 'P0002';
  end if;

  -- compare-and-set: the row must still be in the status the caller saw
  if r.status <> p_expected_status then
    raise exception 'request is % not % (changed concurrently)', r.status, p_expected_status
      using errcode = '40001';
  end if;

  -- legal edges in the workflow state machine
  if v_edge not in ('missing->in_purchase','in_purchase->fulfilled',
                    'missing->cancelled','in_purchase->cancelled','fulfilled->missing') then
    raise exception 'illegal transition %', v_edge using errcode = '22023';
  end if;
  if v_edge = 'fulfilled->missing' and (p_note is null or btrim(p_note) = '') then
    raise exception 'reopening a fulfilled request requires a note' using errcode = '22023';
  end if;

  -- role permission per docs/PERMISSIONS.md §5
  if v_role = 'super_admin' then
    v_allowed := true;
  elsif v_role = 'company_admin' and r.company_id = v_caller_company then
    v_allowed := true; -- admin may run any legal edge (incl. fulfilled->missing)
  elsif v_role = 'sales_rep' and r.company_id = v_caller_company and rep_serves_pharmacy(r.pharmacy_id) then
    v_allowed := v_edge in ('missing->in_purchase','in_purchase->fulfilled',
                            'missing->cancelled','in_purchase->cancelled');
  elsif v_role = 'pharmacist' and r.company_id = v_caller_company and r.pharmacy_id = v_caller_pharmacy then
    v_allowed := v_edge = 'missing->cancelled';
  end if;

  if not v_allowed then
    raise exception 'role % may not perform transition %', v_role, v_edge using errcode = '42501';
  end if;

  update public.shortage_requests
  set status = p_new_status,
      fulfilled_at = case when p_new_status = 'fulfilled' then now()
                          when p_new_status = 'missing' then null
                          else fulfilled_at end,
      cancelled_at = case when p_new_status = 'cancelled' then now()
                          when p_new_status = 'missing' then null
                          else cancelled_at end
  where id = p_request_id;

  insert into public.shortage_status_history
    (shortage_request_id, company_id, old_status, new_status, changed_by, note)
  values
    (p_request_id, r.company_id, p_expected_status, p_new_status, auth.uid(), p_note);
end;
$$;

revoke execute on function public.transition_shortage_status(uuid, text, text, text) from public, anon;
grant execute on function public.transition_shortage_status(uuid, text, text, text) to authenticated;
