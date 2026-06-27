-- Phase 2 / 0002 — JWT custom claims + RLS helper functions.
-- Strategy: DECISIONS/004. Policies read company_id/role from the JWT, never from a
-- profiles query, to avoid recursion on profiles and a per-row lookup elsewhere.

-- Custom access token hook: inject company_id, user_role, is_active into the JWT.
-- Supabase calls this as supabase_auth_admin on token issue/refresh.
-- Enable it in the Dashboard: Authentication > Hooks > Customize Access Token (JWT) Claims
--   -> public.custom_access_token_hook   (also mirrored in supabase/config.toml)
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  v_company_id uuid;
  v_pharmacy_id uuid;
  v_role text;
  v_active boolean;
begin
  select p.company_id, p.pharmacy_id, p.role, p.is_active
    into v_company_id, v_pharmacy_id, v_role, v_active
  from public.profiles p
  where p.id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
    claims := jsonb_set(claims, '{company_id}',
                        coalesce(to_jsonb(v_company_id::text), 'null'::jsonb));
    claims := jsonb_set(claims, '{pharmacy_id}',
                        coalesce(to_jsonb(v_pharmacy_id::text), 'null'::jsonb));
    claims := jsonb_set(claims, '{is_active}', to_jsonb(coalesce(v_active, false)));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The hook runs as supabase_auth_admin; grant it execute, deny everyone else.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Claim readers — STABLE, JWT-only, safe to call inside RLS policies.
create or replace function public.app_company_id()
returns uuid language sql stable
as $$ select nullif(auth.jwt() ->> 'company_id', '')::uuid $$;

create or replace function public.app_pharmacy_id()
returns uuid language sql stable
as $$ select nullif(auth.jwt() ->> 'pharmacy_id', '')::uuid $$;

create or replace function public.app_role()
returns text language sql stable
as $$ select auth.jwt() ->> 'user_role' $$;

create or replace function public.is_super_admin()
returns boolean language sql stable
as $$ select coalesce(auth.jwt() ->> 'user_role', '') = 'super_admin' $$;

create or replace function public.is_active_user()
returns boolean language sql stable
as $$ select coalesce((auth.jwt() ->> 'is_active')::boolean, false) $$;

-- Sales-rep visibility. SECURITY DEFINER so a shortage_requests policy can consult
-- assignments without re-triggering RLS on sales_rep_assignments (recursion guard).
create or replace function public.rep_serves_pharmacy(p_pharmacy uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sales_rep_assignments a
    where a.sales_rep_id = auth.uid()
      and a.pharmacy_id = p_pharmacy
      and a.is_active
  );
$$;
