-- Phase 2 policy tests (pgTAP). Proves the DECISIONS/004 guarantees.
-- Self-contained: builds its own two-tenant fixture (own UUIDs, independent of seed.sql),
-- then acts as each role by setting `request.jwt.claims` + the `authenticated` role —
-- the same inputs auth.uid()/auth.jwt() see for a real session.
begin;
select plan(11);

-- ---- fixtures (as superuser) ----
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','authenticated','authenticated','pha@a.test',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000002','authenticated','authenticated','adm@a.test',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000003','authenticated','authenticated','rep@a.test',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000004','authenticated','authenticated','rep2@a.test',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b0000000-0000-0000-0000-000000000001','authenticated','authenticated','pha@b.test',now(),now()),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000009','authenticated','authenticated','super@x.test',now(),now());

insert into public.companies (id, name) values
  ('a1111111-1111-1111-1111-111111111111','Company A'),
  ('b1111111-1111-1111-1111-111111111111','Company B');

insert into public.pharmacies (id, company_id, name) values
  ('a2222222-2222-2222-2222-222222222222','a1111111-1111-1111-1111-111111111111','Branch A'),
  ('b2222222-2222-2222-2222-222222222222','b1111111-1111-1111-1111-111111111111','Branch B');

insert into public.profiles (id, company_id, pharmacy_id, full_name, role) values
  ('a0000000-0000-0000-0000-000000000001','a1111111-1111-1111-1111-111111111111','a2222222-2222-2222-2222-222222222222','Pharmacist A','pharmacist'),
  ('a0000000-0000-0000-0000-000000000002','a1111111-1111-1111-1111-111111111111',null,'Admin A','company_admin'),
  ('a0000000-0000-0000-0000-000000000003','a1111111-1111-1111-1111-111111111111',null,'Rep A','sales_rep'),
  ('a0000000-0000-0000-0000-000000000004','a1111111-1111-1111-1111-111111111111',null,'Rep A2','sales_rep'),
  ('b0000000-0000-0000-0000-000000000001','b1111111-1111-1111-1111-111111111111','b2222222-2222-2222-2222-222222222222','Pharmacist B','pharmacist'),
  ('00000000-0000-0000-0000-000000000009',null,null,'Super','super_admin');

insert into public.items (id, company_id, name_ar) values
  ('a3333333-3333-3333-3333-333333333333','a1111111-1111-1111-1111-111111111111','صنف أ');

-- Rep A serves Branch A; Rep A2 serves nothing.
insert into public.sales_rep_assignments (company_id, sales_rep_id, pharmacy_id) values
  ('a1111111-1111-1111-1111-111111111111','a0000000-0000-0000-0000-000000000003','a2222222-2222-2222-2222-222222222222');

insert into public.shortage_requests (id, company_id, pharmacy_id, item_id, requested_by, status) values
  ('a4444444-4444-4444-4444-444444444444','a1111111-1111-1111-1111-111111111111',
   'a2222222-2222-2222-2222-222222222222','a3333333-3333-3333-3333-333333333333',
   'a0000000-0000-0000-0000-000000000001','missing');

-- claim templates
create temporary table jwt(label text primary key, claims text);
insert into jwt values
  ('pharmA','{"sub":"a0000000-0000-0000-0000-000000000001","user_role":"pharmacist","company_id":"a1111111-1111-1111-1111-111111111111","pharmacy_id":"a2222222-2222-2222-2222-222222222222","is_active":true}'),
  ('adminA','{"sub":"a0000000-0000-0000-0000-000000000002","user_role":"company_admin","company_id":"a1111111-1111-1111-1111-111111111111","is_active":true}'),
  ('repA','{"sub":"a0000000-0000-0000-0000-000000000003","user_role":"sales_rep","company_id":"a1111111-1111-1111-1111-111111111111","is_active":true}'),
  ('repA2','{"sub":"a0000000-0000-0000-0000-000000000004","user_role":"sales_rep","company_id":"a1111111-1111-1111-1111-111111111111","is_active":true}'),
  ('pharmB','{"sub":"b0000000-0000-0000-0000-000000000001","user_role":"pharmacist","company_id":"b1111111-1111-1111-1111-111111111111","pharmacy_id":"b2222222-2222-2222-2222-222222222222","is_active":true}'),
  ('super','{"sub":"00000000-0000-0000-0000-000000000009","user_role":"super_admin","is_active":true}');

-- ---- READ isolation ----
set local role authenticated;
select set_config('request.jwt.claims', (select claims from jwt where label='pharmA'), true);
select is((select count(*) from shortage_requests)::bigint, 1::bigint, 'pharmacist A sees own-pharmacy request');
select is((select count(*) from items)::bigint, 1::bigint, 'pharmacist A sees own-company items');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', (select claims from jwt where label='pharmB'), true);
select is((select count(*) from shortage_requests)::bigint, 0::bigint, 'pharmacist B sees no Company A requests (tenant isolation)');
select is((select count(*) from items)::bigint, 0::bigint, 'pharmacist B sees no Company A items');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', (select claims from jwt where label='adminA'), true);
select is((select count(*) from shortage_requests)::bigint, 1::bigint, 'admin A sees whole-tenant request');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', (select claims from jwt where label='repA'), true);
select is((select count(*) from shortage_requests)::bigint, 1::bigint, 'assigned rep sees the request');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', (select claims from jwt where label='repA2'), true);
select is((select count(*) from shortage_requests)::bigint, 0::bigint, 'unassigned rep sees nothing');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', (select claims from jwt where label='super'), true);
select is((select count(*) from shortage_requests)::bigint, 1::bigint, 'super_admin crosses tenants');
reset role;

-- ---- WRITE / workflow enforcement ----
-- pharmacist cannot start a purchase (missing->in_purchase)
set local role authenticated;
select set_config('request.jwt.claims', (select claims from jwt where label='pharmA'), true);
select throws_ok(
  $$ select transition_shortage_status('a4444444-4444-4444-4444-444444444444','missing','in_purchase') $$,
  '42501', null, 'pharmacist denied missing->in_purchase');
reset role;

-- compare-and-set: wrong expected status is rejected (assigned rep, stale read)
set local role authenticated;
select set_config('request.jwt.claims', (select claims from jwt where label='repA'), true);
select throws_ok(
  $$ select transition_shortage_status('a4444444-4444-4444-4444-444444444444','in_purchase','fulfilled') $$,
  '40001', null, 'stale expected_status rejected (compare-and-set)');

-- assigned rep can legitimately start the purchase
select lives_ok(
  $$ select transition_shortage_status('a4444444-4444-4444-4444-444444444444','missing','in_purchase') $$,
  'assigned rep may start purchase');
reset role;

select * from finish();
rollback;
