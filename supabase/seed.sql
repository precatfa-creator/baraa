-- Phase 2 seed — dev/staging data: one company, one pharmacy, three users
-- (company_admin, pharmacist, sales_rep), sample items, one assignment.
-- Creates auth.users directly; NOT for production. All passwords: 'password123'.
-- Fixed UUIDs so policy tests can reference rows deterministically.

-- ---- auth users (email/password) ----
-- helper: insert a confirmed email user + matching identity.
-- Token columns are set to '' (not left NULL): GoTrue scans them into Go strings and
-- a NULL there makes every login fail with "Database error querying schema".
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data, is_sso_user,
   confirmation_token, recovery_token, email_change, email_change_token_new,
   email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('00000000-0000-0000-0000-000000000000','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated','authenticated','admin@baraa.test', crypt('password123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,
   '','','','','','','',''),
  ('00000000-0000-0000-0000-000000000000','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'authenticated','authenticated','pharmacist@baraa.test', crypt('password123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,
   '','','','','','','',''),
  ('00000000-0000-0000-0000-000000000000','cccccccc-cccc-cccc-cccc-cccccccccccc',
   'authenticated','authenticated','rep@baraa.test', crypt('password123', gen_salt('bf')),
   now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false,
   '','','','','','','','');

insert into auth.identities
  (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   jsonb_build_object('sub','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','email','admin@baraa.test'),
   'email', now(), now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   jsonb_build_object('sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','email','pharmacist@baraa.test'),
   'email', now(), now(), now()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','cccccccc-cccc-cccc-cccc-cccccccccccc',
   jsonb_build_object('sub','cccccccc-cccc-cccc-cccc-cccccccccccc','email','rep@baraa.test'),
   'email', now(), now(), now());

-- ---- tenant data ----
insert into public.companies (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'صيدلية براء التجريبية', 'baraa-demo');

insert into public.pharmacies (id, company_id, name, phone)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
        'فرع المركز', '0100000000');

insert into public.profiles (id, company_id, pharmacy_id, full_name, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111', null,
   'مدير الشركة', 'company_admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'الصيدلي', 'pharmacist'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','11111111-1111-1111-1111-111111111111', null,
   'مندوب المبيعات', 'sales_rep');

insert into public.items (id, company_id, name_ar, name_en, barcode, category, unit, created_by)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddd01','11111111-1111-1111-1111-111111111111',
   'باراسيتامول 500', 'Paracetamol 500', '6221000000011', 'مسكنات', 'علبة',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02','11111111-1111-1111-1111-111111111111',
   'أموكسيسيلين 500', 'Amoxicillin 500', '6221000000028', 'مضادات حيوية', 'علبة',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03','11111111-1111-1111-1111-111111111111',
   'فيتامين سي', 'Vitamin C', null, 'فيتامينات', 'علبة',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- rep serves the branch (enables auto-assign on create + rep visibility)
insert into public.sales_rep_assignments (company_id, sales_rep_id, pharmacy_id)
values ('11111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '22222222-2222-2222-2222-222222222222');
