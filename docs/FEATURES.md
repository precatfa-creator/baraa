# Features

Status values:

- `planned` — not started.
- `mvp` — required for MVP.
- `later` — future SaaS feature.
- `optional` — useful but not required.

## MVP features

| Feature | Status | Notes |
|---|---:|---|
| Arabic RTL app shell | mvp | `lang=ar`, `dir=rtl`, mobile-first. |
| Email/password login | mvp | Supabase Auth. |
| Protected routes | mvp | Redirect unauthenticated users. |
| User profiles | mvp | Linked to Supabase Auth user id. |
| Role model | mvp | Super Admin, Company Admin, Pharmacist, Sales Rep. |
| Companies | mvp | SaaS tenant root. |
| Pharmacies/branches | mvp | Belong to companies. |
| Item master data | mvp | Products/medicines with Arabic name, barcode, category. |
| Shortage requests | mvp | Main operational workflow. |
| Status workflow | mvp | missing → in_purchase → fulfilled, plus cancelled. |
| Status history | mvp | Audit trail for every transition. |
| Sales rep assignments | mvp | Sales reps serve assigned pharmacies. |
| Basic dashboard | mvp | Counts and active requests. |
| Search/filter shortage requests | mvp | By status, item, pharmacy. |
| Pagination | mvp | Avoid over-fetching. |
| RLS policies | mvp | Tenant and role protection. |
| Server actions/API routes | mvp | Mutations and validation. |
| Basic testing | mvp | Validation, permissions, workflow. |
| Vercel/Supabase deployment | mvp | Staging and production. |

## Later SaaS features

| Feature | Status | Notes |
|---|---:|---|
| Stripe billing | later | Plans and subscriptions. |
| User invitations | later | Admin invites users. |
| Email notifications | later | Resend. |
| WhatsApp notifications | later | Optional integration. |
| Advanced reports | later | Fulfillment time, repeated shortages. |
| Export to CSV/Excel | later | Reports and item data. |
| Realtime updates at scale | later | Carefully filtered subscriptions. |
| AI duplicate detection | later | Batch/cached AI calls only. |
| Native mobile app | later | Only if web app is not enough. |
| ERP/inventory integrations | later | Per customer need. |

## Feature priority

1. Auth and tenant-safe data access.
2. Item master data.
3. Shortage request workflow.
4. Role-specific dashboards.
5. Admin assignment/users.
6. Testing and deployment.
7. SaaS hardening.
