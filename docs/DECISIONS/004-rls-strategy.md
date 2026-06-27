# Decision 004 — RLS Strategy

## Decision

Tenant isolation and role access are enforced with PostgreSQL Row Level Security as the primary security boundary. To make this safe and avoid the known Supabase footguns, the RLS implementation follows four rules:

1. Read tenant/role from JWT claims, not from a `profiles` query inside policies.
2. Default-deny on every tenant-owned table.
3. `super_admin` cross-tenant access goes through one audited helper, not ad-hoc policy branches.
4. RLS policy tests are a Phase 2 exit criterion, not a Phase 8 task.

This decision refines `docs/SECURITY.md`, `docs/DECISIONS/002-supabase-architecture.md`, and `docs/DECISIONS/003-multi-tenancy-model.md`. It must be settled before any migration is written.

## Reason

The whole design relies on a shared-table multi-tenant model where one missing or wrong policy is a silent cross-tenant data leak. The stack is not the risk; correct RLS is. These rules remove the two most common ways RLS goes wrong on Supabase (recursive policy lookups and untested default-allow gaps) and keep the `super_admin` bypass in one reviewable place.

## Rules

### 1. Tenant/role come from the JWT, not from `profiles`

A policy on `profiles` that queries `profiles` to find the user's `company_id`/`role` causes infinite-recursion errors, and doing the same lookup on every other table is an N+1 per request.

- Store `company_id` and `role` as custom claims in the auth token (Supabase `app_metadata` via a custom access-token / auth hook).
- Read them in policies with `auth.jwt()`, e.g. `(auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid`.
- When a user's company or role changes, refresh the claims; treat the token as a cache of `profiles`, with `profiles` as the source of truth.
- Any unavoidable profile lookup inside a policy uses a `SECURITY DEFINER` helper that does not re-trigger RLS.

### 2. Default-deny

- Enable RLS on every tenant-owned table (`companies`, `pharmacies`, `profiles`, `items`, `shortage_requests`, `shortage_status_history`, `sales_rep_assignments`).
- A table with RLS enabled and no matching policy denies by default. Add access only through explicit, role-scoped policies. Never rely on the absence of a policy meaning "allow".

### 3. `super_admin` bypass is centralized

- Cross-tenant access exists only for `super_admin` performing platform/support work.
- Implement it as a single helper (e.g. `is_super_admin()` reading the JWT role claim) referenced by policies, not as copy-pasted branches.
- Every policy that grants `super_admin` access is covered by a test asserting non-super users are still blocked.

### 4. Policies must be tested in Phase 2

- Add a seeded policy-test suite (pgTAP or an equivalent seeded harness) proving, at minimum:
  - User in company A cannot read or write any row in company B.
  - Pharmacist sees only their own `pharmacy_id` requests.
  - Sales rep sees only requests for pharmacies in `sales_rep_assignments`.
  - `super_admin` can cross tenants; no other role can.
- These tests passing is part of the Phase 2 exit criteria in `planning/mvp_plan.md`.

## Related execution rules

These are not RLS itself but must land alongside it:

- **Profile creation.** No public signup. A tenant-bound profile is created by an admin server action using the service role key (a trigger on `auth.users` cannot know `company_id`). Document the flow in `docs/AUTH.md`.
- **Assignment authority.** `sales_rep_assignments` is the authority for sales-rep visibility. `shortage_requests.assigned_to` is a snapshot of the handling rep at creation time. `create_shortage_request` auto-assigns only when exactly one active assignment exists for the pharmacy; otherwise it leaves `assigned_to` null.
- **Transition races.** `transition_shortage_status` performs a guarded compare-and-set (`update ... where status = <expected_old>`) so a second concurrent transition fails cleanly instead of double-applying.

## Alternatives considered

### Profile-table lookups in policies

Rejected: causes recursion on `profiles` and an extra read per row elsewhere. JWT claims are the standard Supabase pattern for this.

### Application-only tenant checks (RLS disabled)

Rejected: violates `docs/DECISIONS/002`. A bug in one server action would expose all tenants. RLS is the last line of defense and stays on.
