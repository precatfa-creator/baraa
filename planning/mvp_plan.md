# Baraa MVP Implementation Plan

> For Hermes/AI coding agents: implement this plan phase-by-phase. Do not skip verification. Keep business logic out of messy client code. Use server actions/database functions/RLS for important rules.

## Goal

Build a working Arabic RTL, SaaS-ready shortage-management web app for pharmacies using Next.js, TypeScript, Tailwind, shadcn/ui, and Supabase/PostgreSQL.

## Architecture

Frontend is Next.js App Router with Arabic RTL UI. Supabase provides Auth/PostgreSQL/RLS. Critical mutations go through server actions and database functions. Tenant isolation is enforced with `company_id`, `pharmacy_id`, RLS, and role checks.

## Phase 0 — Documentation and decisions

Objective: confirm product, schema, permissions, and workflow before code.

Tasks:

1. Review `docs/PRD.md`.
2. Review `docs/DATABASE.md`.
3. Review `docs/PERMISSIONS.md`.
4. Review `docs/UI_UX.md`.
5. Confirm MVP workflow:
   - missing → in_purchase → fulfilled
   - missing/in_purchase → cancelled
6. Confirm no public signup for MVP.
7. Confirm Arabic UI and English code/database values.

Exit criteria:

- Core docs accepted.
- No blocking ambiguity in roles/workflow/schema.

## Phase 1 — Project setup

Objective: create runnable Next.js app.

Tasks:

1. Initialize Next.js with TypeScript.
2. Install Tailwind CSS.
3. Install shadcn/ui.
4. Add Arabic RTL root layout.
5. Add Tajawal/Cairo font.
6. Create route groups for auth/dashboard.
7. Add basic AppShell.
8. Verify app runs locally.

Exit criteria:

- Local app runs.
- `/login` and `/dashboard` render.
- Layout is RTL.

## Phase 2 — Supabase database foundation

Objective: create schema, indexes, RLS, and seed data.

Tasks:

1. Create Supabase project.
2. Add migrations for core tables.
3. Add constraints/checks.
4. Add indexes from `docs/DATABASE.md`.
5. Enable RLS on all tenant tables.
6. Create helper functions to get current profile/role/company.
7. Add RLS policies.
8. Add workflow functions:
   - `create_shortage_request`
   - `transition_shortage_status`
9. Add seed data for one company, one pharmacy, one pharmacist, one sales rep, sample items.
10. Test cross-company and role access.

Exit criteria:

- Schema exists.
- RLS blocks unauthorized access.
- Workflow functions create history.

## Phase 3 — Auth and protected app

Objective: users can log in and reach role-appropriate screens.

Tasks:

1. Configure Supabase browser/server clients.
2. Build login form.
3. Add protected route middleware/server checks.
4. Load active profile after login.
5. Add role-based navigation.
6. Add inactive/missing profile error states.
7. Add logout.

Exit criteria:

- Each test user can log in.
- Unauthorized users are redirected.
- Inactive users are blocked.

## Phase 4 — Item master data

Objective: admins can manage items; users can search/select items.

Tasks:

1. Build items page.
2. Add paginated item list.
3. Add search by Arabic name/barcode.
4. Add create item dialog.
5. Add edit item dialog for admins.
6. Add validation.
7. Add duplicate barcode handling.
8. Add item search combobox for request forms.

Exit criteria:

- Item master data works.
- Searches are paginated/filterable.
- Permissions are enforced server/database-side.

## Phase 5 — Shortage workflow

Objective: complete core pharmacist-sales rep workflow.

Tasks:

1. Build active requests page.
2. Add status tabs/filters.
3. Add create shortage dialog.
4. Call server action to create request.
5. Build request card/table components.
6. Build status transition buttons.
7. Call server action/database function for transitions.
8. Show status history on request detail.
9. Add friendly Arabic toasts/errors.

Exit criteria:

- Pharmacist creates request.
- Sales rep sees assigned request.
- Sales rep changes status.
- History records transitions.

## Phase 6 — Dashboard and realtime

Objective: make daily operation easy.

Tasks:

1. Add dashboard summary cards.
2. Show active requests by status.
3. Add quick filters.
4. Add refresh/revalidation after actions.
5. Add narrowly scoped realtime only if useful.
6. Avoid broad subscriptions.

Exit criteria:

- Dashboard gives clear operational view.
- No over-fetching historical data.

## Phase 7 — Admin screens

Objective: company admin can manage company operations.

Tasks:

1. Build pharmacies page.
2. Build users page.
3. Build sales rep assignments page.
4. Add activate/deactivate user/pharmacy.
5. Add role restrictions.
6. Add validation.

Exit criteria:

- Admin can manage users/pharmacies/assignments.
- Sales rep visibility changes based on assignments.

## Phase 8 — Testing, security, deployment

Objective: prepare for real use.

Tasks:

1. Add unit tests for validation/status mapping.
2. Add integration tests for permissions/workflow functions.
3. Add Playwright smoke flows.
4. Test Arabic RTL on mobile sizes.
5. Test iOS Safari and Android Chrome manually.
6. Verify no service role key in client.
7. Deploy to Vercel/Supabase staging.
8. Run production readiness checklist.

Exit criteria:

- Staging app works end-to-end.
- Permission tests pass.
- Mobile UX is acceptable.

## Phase 9 — SaaS hardening later

Objective: grow beyond MVP.

Future tasks:

- Stripe billing.
- Invite flow.
- Advanced reports.
- Notifications.
- CSV import/export.
- Monitoring/Sentry.
- Analytics/PostHog.
- AI features only with cost/caching controls.
