-- Test prerequisites: pgTAP + let the authenticated role run assertion functions
-- (policy tests switch to `authenticated` so RLS applies, then call pgTAP from it).
create extension if not exists pgtap with schema extensions;
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
