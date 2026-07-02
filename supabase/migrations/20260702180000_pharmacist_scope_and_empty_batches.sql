-- Pharmacists see and act only on requests they personally submitted, including
-- deduplicated requester rows. Cancelling the last active item closes its batch.

create or replace function public.is_shortage_requester(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shortage_request_requesters requester
    where requester.shortage_request_id = p_request_id
      and requester.profile_id = auth.uid()
  )
$$;
revoke execute on function public.is_shortage_requester(uuid) from public, anon;
grant execute on function public.is_shortage_requester(uuid) to authenticated;

drop policy shortage_requests_select on public.shortage_requests;
create policy shortage_requests_select on public.shortage_requests
  for select to authenticated
  using (
    is_super_admin()
    or (
      is_active_user() and company_id = app_company_id() and (
        app_role() = 'company_admin'
        or (
          app_role() = 'pharmacist'
          and (requested_by = auth.uid() or is_shortage_requester(id))
        )
        or (app_role() = 'sales_rep' and rep_serves_pharmacy(pharmacy_id))
      )
    )
  );

create or replace function public.guard_pharmacist_request_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status
     and new.status = 'cancelled'
     and app_role() = 'pharmacist'
     and not public.is_shortage_requester(old.id)
  then
    raise exception 'pharmacist did not submit this request' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger shortage_requests_guard_pharmacist_transition
before update of status on public.shortage_requests
for each row execute function public.guard_pharmacist_request_transition();

create or replace function public.close_batch_without_active_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and new.batch_id is not null then
    update public.batches batch
    set status = 'closed', closed_at = coalesce(batch.closed_at, now())
    where batch.id = new.batch_id
      and batch.status in ('open', 'in_market')
      and not exists (
        select 1
        from public.shortage_requests request
        where request.batch_id = batch.id
          and request.status in ('missing', 'in_purchase')
      );
  end if;
  return new;
end;
$$;

create trigger shortage_requests_close_empty_batch
after update of status on public.shortage_requests
for each row
when (new.status = 'cancelled')
execute function public.close_batch_without_active_items();

-- Repair already-empty open batches produced before this invariant existed.
update public.batches batch
set status = 'closed', closed_at = coalesce(batch.closed_at, now())
where batch.status = 'open'
  and not exists (
    select 1
    from public.shortage_requests request
    where request.batch_id = batch.id
      and request.status in ('missing', 'in_purchase')
  );
