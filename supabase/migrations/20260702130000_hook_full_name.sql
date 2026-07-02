-- Add full_name to the JWT claims so getCurrentProfile can be built entirely from
-- the token (no per-page auth.getUser() + profiles SELECT). Mirrors 0002's hook.
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
  v_full_name text;
begin
  select p.company_id, p.pharmacy_id, p.role, p.is_active, p.full_name
    into v_company_id, v_pharmacy_id, v_role, v_active, v_full_name
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
    claims := jsonb_set(claims, '{full_name}', coalesce(to_jsonb(v_full_name), '""'::jsonb));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
