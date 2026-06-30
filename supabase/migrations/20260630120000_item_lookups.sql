-- Item lookups — per-tenant category & unit pick-lists for the item form.
-- items.category/unit stay free text (a label snapshot on the item); these tables
-- just supply the dropdown options. Values typed on the item form are auto-registered
-- here by the server action, so "pick from the list OR add a new one" needs no UI.

create table public.item_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index item_categories_company_name_uniq on public.item_categories(company_id, name);
create index item_categories_company_idx on public.item_categories(company_id);

create table public.item_units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index item_units_company_name_uniq on public.item_units(company_id, name);
create index item_units_company_idx on public.item_units(company_id);

-- RLS: tenant members read; company_admin writes. Mirrors items (0003).
alter table public.item_categories enable row level security;
alter table public.item_units      enable row level security;

create policy item_categories_select on public.item_categories
  for select to authenticated
  using (is_super_admin() or (is_active_user() and company_id = app_company_id()));
create policy item_categories_admin_write on public.item_categories
  for all to authenticated
  using (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  )
  with check (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  );

create policy item_units_select on public.item_units
  for select to authenticated
  using (is_super_admin() or (is_active_user() and company_id = app_company_id()));
create policy item_units_admin_write on public.item_units
  for all to authenticated
  using (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  )
  with check (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  );

-- Backfill from existing item values so the lists aren't empty on first use.
insert into public.item_categories (company_id, name)
select distinct company_id, btrim(category) from public.items
where category is not null and btrim(category) <> ''
on conflict (company_id, name) do nothing;

insert into public.item_units (company_id, name)
select distinct company_id, btrim(unit) from public.items
where unit is not null and btrim(unit) <> ''
on conflict (company_id, name) do nothing;
