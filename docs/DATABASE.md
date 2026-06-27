# Database Design

## 1. Database principles

- PostgreSQL is the source of truth.
- Use English enum/status values in database.
- Display Arabic labels in UI only.
- Use `company_id` for SaaS tenant isolation.
- Use `pharmacy_id` where pharmacy-level access is needed.
- Use RLS on tenant-owned tables.
- Use indexes for common filters.
- Use status history for audit.
- Paginate large lists.

## 2. Core tables

### companies

Tenant root.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `slug text unique`
- `subscription_status text default 'trial'`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### pharmacies

Branches inside a company.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `company_id uuid not null references companies(id)`
- `name text not null`
- `address text`
- `phone text`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `pharmacies(company_id)`
- `pharmacies(company_id, is_active)`

### profiles

Application profile linked to Supabase Auth users.

Columns:

- `id uuid primary key references auth.users(id)`
- `company_id uuid references companies(id)`
- `pharmacy_id uuid references pharmacies(id)`
- `full_name text not null`
- `role text not null check (role in ('super_admin','company_admin','pharmacist','sales_rep'))`
- `phone text`
- `is_active boolean default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `profiles(company_id)`
- `profiles(company_id, role)`
- `profiles(pharmacy_id)`

### items

Master data for medicines/products.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `company_id uuid not null references companies(id)`
- `name_ar text not null`
- `name_en text`
- `barcode text`
- `sku text`
- `category text`
- `unit text`
- `is_active boolean default true`
- `created_by uuid references profiles(id)`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Constraints:

- Unique barcode per company when barcode is not null.

Indexes:

- `items(company_id)`
- `items(company_id, is_active)`
- `items(company_id, barcode)`
- `items(company_id, name_ar)`

### shortage_requests

Operational shortage records.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `company_id uuid not null references companies(id)`
- `pharmacy_id uuid not null references pharmacies(id)`
- `item_id uuid not null references items(id)`
- `requested_by uuid not null references profiles(id)`
- `assigned_to uuid references profiles(id)`
- `quantity numeric(12,2) default 1`
- `status text not null default 'missing' check (status in ('missing','in_purchase','fulfilled','cancelled'))`
- `priority text default 'normal' check (priority in ('low','normal','high','urgent'))`
- `notes text`
- `fulfilled_at timestamptz`
- `cancelled_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

Indexes:

- `shortage_requests(company_id)`
- `shortage_requests(company_id, status)`
- `shortage_requests(pharmacy_id, status)`
- `shortage_requests(assigned_to, status)`
- `shortage_requests(item_id)`
- `shortage_requests(created_at desc)`
- partial index for active requests: `where status in ('missing','in_purchase')`

### shortage_status_history

Audit trail for status transitions.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `shortage_request_id uuid not null references shortage_requests(id)`
- `company_id uuid not null references companies(id)`
- `old_status text`
- `new_status text not null`
- `changed_by uuid not null references profiles(id)`
- `note text`
- `created_at timestamptz default now()`

Indexes:

- `shortage_status_history(shortage_request_id, created_at)`
- `shortage_status_history(company_id, created_at)`

### sales_rep_assignments

Controls which sales rep serves which pharmacy.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `company_id uuid not null references companies(id)`
- `sales_rep_id uuid not null references profiles(id)`
- `pharmacy_id uuid not null references pharmacies(id)`
- `is_active boolean default true`
- `created_at timestamptz default now()`

Constraints:

- Unique active assignment per sales rep/pharmacy pair.

Indexes:

- `sales_rep_assignments(company_id)`
- `sales_rep_assignments(sales_rep_id, pharmacy_id)`
- `sales_rep_assignments(pharmacy_id)`

## 3. Recommended database functions

### transition_shortage_status

Inputs:

- `p_request_id uuid`
- `p_new_status text`
- `p_note text default null`

Responsibilities:

- Get current user profile.
- Verify tenant access.
- Verify role permission.
- Verify valid transition.
- Update request status.
- Set `fulfilled_at` or `cancelled_at` when relevant.
- Insert row into `shortage_status_history`.

### create_shortage_request

Responsibilities:

- Validate item belongs to company.
- Validate pharmacy belongs to company.
- Create request with status `missing`.
- Optionally assign sales rep automatically if one assignment exists.
- Insert initial status history row.

## 4. RLS requirements

Enable RLS on:

- companies
- pharmacies
- profiles
- items
- shortage_requests
- shortage_status_history
- sales_rep_assignments

Access rules are defined in `docs/PERMISSIONS.md`.

## 5. Common bottlenecks to avoid

- Missing indexes.
- Fetching all historical requests.
- N+1 queries for item/user/pharmacy data.
- Broad realtime subscriptions.
- Complex business logic split inconsistently between client and server.
