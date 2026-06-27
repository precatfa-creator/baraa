-- Phase 2 / 0003 — Row Level Security: default-deny + role-scoped policies.
-- Model (DECISIONS/004): RLS enforces READ isolation; workflow WRITES go through the
-- SECURITY DEFINER functions in 0004. Admin CRUD (companies/pharmacies/profiles/items/
-- assignments) is done through explicit write policies here.
-- Every policy reads tenant/role from the JWT helpers, never from a profiles subquery.

-- Enable RLS everywhere (RLS-enabled + no matching policy = deny).
alter table public.companies              enable row level security;
alter table public.pharmacies             enable row level security;
alter table public.profiles               enable row level security;
alter table public.items                  enable row level security;
alter table public.shortage_requests      enable row level security;
alter table public.shortage_status_history enable row level security;
alter table public.sales_rep_assignments  enable row level security;

-- ---------------------------------------------------------------------------
-- companies — platform-managed; members read their own tenant.
-- ---------------------------------------------------------------------------
create policy companies_select on public.companies
  for select to authenticated
  using (is_super_admin() or (is_active_user() and id = app_company_id()));

create policy companies_write on public.companies
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ---------------------------------------------------------------------------
-- pharmacies — company members read all branches in their tenant; admins manage.
-- ---------------------------------------------------------------------------
create policy pharmacies_select on public.pharmacies
  for select to authenticated
  using (is_super_admin() or (is_active_user() and company_id = app_company_id()));

create policy pharmacies_write on public.pharmacies
  for all to authenticated
  using (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  )
  with check (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  );

-- ---------------------------------------------------------------------------
-- profiles — self + same-tenant read; admins manage. New profiles are created by
-- the service role (AUTH.md), which bypasses RLS, so no broad INSERT policy here.
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or is_super_admin()
    or (is_active_user() and company_id = app_company_id())
  );

create policy profiles_admin_write on public.profiles
  for all to authenticated
  using (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  )
  with check (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  );

-- The custom_access_token_hook (0002) runs as supabase_auth_admin and must read profiles.
grant select on table public.profiles to supabase_auth_admin;
create policy profiles_auth_admin_read on public.profiles
  for select to supabase_auth_admin
  using (true);

-- ---------------------------------------------------------------------------
-- items — company members read; admins write. No DELETE policy (soft-delete via is_active).
-- ---------------------------------------------------------------------------
create policy items_select on public.items
  for select to authenticated
  using (is_super_admin() or (is_active_user() and company_id = app_company_id()));

create policy items_admin_insert on public.items
  for insert to authenticated
  with check (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  );

create policy items_admin_update on public.items
  for update to authenticated
  using (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  )
  with check (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  );

-- ---------------------------------------------------------------------------
-- shortage_requests — READ scoped by role; writes only via 0004 functions.
--   company_admin: whole tenant; pharmacist: own pharmacy; sales_rep: assigned pharmacies.
-- ---------------------------------------------------------------------------
create policy shortage_requests_select on public.shortage_requests
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
-- shortage_status_history — same visibility as the parent request; inserts via 0004.
-- ---------------------------------------------------------------------------
create policy shortage_history_select on public.shortage_status_history
  for select to authenticated
  using (
    is_super_admin()
    or exists (
      select 1 from public.shortage_requests r
      where r.id = shortage_request_id
      -- parent row visibility is itself RLS-checked, so this stays tenant/role safe
    )
  );

-- ---------------------------------------------------------------------------
-- sales_rep_assignments — admins manage; a rep can read their own assignments.
-- ---------------------------------------------------------------------------
create policy assignments_select on public.sales_rep_assignments
  for select to authenticated
  using (
    is_super_admin()
    or (is_active_user() and company_id = app_company_id() and (
      app_role() = 'company_admin'
      or (app_role() = 'sales_rep' and sales_rep_id = auth.uid())
    ))
  );

create policy assignments_admin_write on public.sales_rep_assignments
  for all to authenticated
  using (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  )
  with check (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  );
