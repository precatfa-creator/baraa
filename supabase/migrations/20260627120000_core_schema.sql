-- Phase 2 / 0001 — Core schema: tenant tables, constraints, indexes, updated_at triggers.
-- DB stores English enum/role/status values; Arabic labels live in the UI only.
-- Schema source of truth: docs/DATABASE.md. Multi-tenancy: docs/DECISIONS/003.

create extension if not exists pgcrypto; -- gen_random_uuid()

-- updated_at maintenance, shared by all mutable tables
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- companies — tenant root
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  subscription_status text not null default 'trial',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- pharmacies — branches inside a company
create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pharmacies_company_id_idx on public.pharmacies(company_id);
create index pharmacies_company_active_idx on public.pharmacies(company_id, is_active);

-- profiles — app profile, 1:1 with auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id),
  pharmacy_id uuid references public.pharmacies(id),
  full_name text not null,
  role text not null check (role in ('super_admin','company_admin','pharmacist','sales_rep')),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_company_id_idx on public.profiles(company_id);
create index profiles_company_role_idx on public.profiles(company_id, role);
create index profiles_pharmacy_id_idx on public.profiles(pharmacy_id);

-- items — medicines/products master data
create table public.items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name_ar text not null,
  name_en text,
  barcode text,
  sku text,
  category text,
  unit text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- barcode unique per company, only when present
create unique index items_company_barcode_uniq on public.items(company_id, barcode) where barcode is not null;
create index items_company_id_idx on public.items(company_id);
create index items_company_active_idx on public.items(company_id, is_active);
create index items_company_name_ar_idx on public.items(company_id, name_ar);

-- shortage_requests — operational records
create table public.shortage_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id),
  item_id uuid not null references public.items(id),
  requested_by uuid not null references public.profiles(id),
  -- snapshot of the handling rep at creation; sales_rep_assignments is the visibility authority (DECISIONS/004)
  assigned_to uuid references public.profiles(id),
  quantity numeric(12,2) not null default 1,
  status text not null default 'missing' check (status in ('missing','in_purchase','fulfilled','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  notes text,
  fulfilled_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shortage_requests_company_idx on public.shortage_requests(company_id);
create index shortage_requests_company_status_idx on public.shortage_requests(company_id, status);
create index shortage_requests_pharmacy_status_idx on public.shortage_requests(pharmacy_id, status);
create index shortage_requests_assigned_status_idx on public.shortage_requests(assigned_to, status);
create index shortage_requests_item_idx on public.shortage_requests(item_id);
create index shortage_requests_created_at_idx on public.shortage_requests(created_at desc);
-- hot path: active requests per tenant
create index shortage_requests_active_idx on public.shortage_requests(company_id, status)
  where status in ('missing','in_purchase');

-- shortage_status_history — audit trail
create table public.shortage_status_history (
  id uuid primary key default gen_random_uuid(),
  shortage_request_id uuid not null references public.shortage_requests(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid not null references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create index shortage_history_request_idx on public.shortage_status_history(shortage_request_id, created_at);
create index shortage_history_company_idx on public.shortage_status_history(company_id, created_at);

-- sales_rep_assignments — which rep serves which pharmacy
create table public.sales_rep_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  sales_rep_id uuid not null references public.profiles(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
-- one active assignment per rep/pharmacy pair
create unique index sales_rep_assignment_active_uniq on public.sales_rep_assignments(sales_rep_id, pharmacy_id) where is_active;
create index sales_rep_assignments_company_idx on public.sales_rep_assignments(company_id);
create index sales_rep_assignments_rep_pharmacy_idx on public.sales_rep_assignments(sales_rep_id, pharmacy_id);
create index sales_rep_assignments_pharmacy_idx on public.sales_rep_assignments(pharmacy_id);

-- updated_at triggers (history has no updated_at; assignments are insert/deactivate only)
create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger pharmacies_set_updated_at before update on public.pharmacies
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();
create trigger shortage_requests_set_updated_at before update on public.shortage_requests
  for each row execute function public.set_updated_at();
