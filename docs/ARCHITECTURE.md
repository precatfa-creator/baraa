# Architecture

## 1. Overview

Baraa is a Next.js + Supabase SaaS web application. The frontend is Arabic RTL and mobile-first. Supabase provides PostgreSQL, Auth, RLS, and optional realtime. Important business rules are enforced through server actions/API routes and PostgreSQL policies/functions, not only in client-side components.

## 2. High-level components

```text
Browser
  ↓
Next.js App Router
  ├─ Server Components for protected data reads
  ├─ Client Components for interactivity/forms
  ├─ Server Actions/API Routes for mutations
  ↓
Supabase
  ├─ Auth
  ├─ PostgreSQL
  ├─ RLS Policies
  ├─ DB Functions/Triggers
  └─ Realtime later where useful
```

## 3. Frontend responsibilities

The UI is responsible for:

- Arabic labels.
- RTL layout.
- Forms.
- Loading states.
- Empty states.
- Friendly error messages.
- Displaying status badges/actions based on server-provided permissions.

The UI is not the final authority for:

- Tenant access.
- Role permissions.
- Workflow transitions.
- Audit history.
- Critical validation.

## 4. Server responsibilities

Next.js server actions/API routes handle:

- Form parsing.
- Zod validation.
- Session lookup.
- Calling secure database functions.
- Returning normalized errors.
- Future notifications.
- Future billing webhooks.

Recommended server action files:

```text
src/actions/items.ts
src/actions/requests.ts
src/actions/users.ts
src/actions/pharmacies.ts
src/actions/assignments.ts
```

## 5. Database responsibilities

PostgreSQL handles:

- Data persistence.
- Tenant relationships.
- RLS-based data isolation.
- Workflow-safe functions.
- Status history triggers/functions.
- Indexes for performance.

## 6. Supabase client usage rule

Allowed:

- Session reads.
- Simple select queries where RLS protects results.
- Realtime subscriptions to narrowly filtered data.

Avoid:

- Direct client mutations for critical workflow changes.
- Complex role logic in React components.
- Broad table subscriptions.
- Fetching unpaginated historical data.

## 7. Multi-tenancy model

- `companies` is the tenant root.
- Most business tables have `company_id`.
- Pharmacy-level tables also have `pharmacy_id`.
- RLS policies ensure a user only sees allowed company/pharmacy rows.

## 8. Workflow model

MVP workflow:

```text
missing → in_purchase → fulfilled
missing → cancelled
in_purchase → cancelled
```

Status changes should go through a function/action, not arbitrary direct updates.

## 9. Performance principles

- Index all common filters and joins.
- Paginate lists from day one.
- Avoid N+1 query patterns.
- Use views/RPC for complex list screens if needed.
- Cache expensive reports later.
- Keep realtime subscriptions narrow.

## 10. Future architecture extensions

- Stripe billing.
- Resend email notifications.
- Sentry error tracking.
- PostHog analytics.
- Background jobs for reports/AI/imports.
- API integrations with inventory systems.
