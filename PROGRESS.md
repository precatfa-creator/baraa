# Build Progress — Baraa (براء)

Living checklist for building the app. Update the status emoji and tick tasks as you go. Source of truth for *what* to build is `planning/mvp_plan.md`; this file tracks *where we are*.

**Legend:** ⬜ not started · 🟡 in progress · ✅ done · ⛔ blocked

**Last updated:** 2026-06-28

## Status at a glance

| Phase | Title | Status |
|---|---|---|
| 0 | Documentation & decisions | ✅ |
| 1 | Project setup | ✅ |
| 2 | Supabase database foundation | ✅ |
| 3 | Auth & protected app | ✅ |
| 4 | Item master data | ✅ |
| 5 | Shortage workflow | ⬜ |
| 6 | Dashboard & realtime | ⬜ |
| 7 | Admin screens | ⬜ |
| 8 | Testing, security, deployment | ⬜ |
| 9 | SaaS hardening (post-MVP) | ⬜ |

**Now:** Phase 4 complete — items list (paginated + search), admin create/edit dialogs, validation, duplicate-barcode handling, role gating (UI + RLS) all verified live. Next up: Phase 5 (shortage workflow — the core feature).

## Decisions locked (read before coding)

- Stack: Next.js App Router + TS + Tailwind + shadcn/ui + Supabase + Vercel — `docs/DECISIONS/001-tech-stack.md`
- Business logic lives in server actions + DB functions + RLS, not the client — `docs/DECISIONS/002-supabase-architecture.md`
- Multi-tenant via `company_id` / `pharmacy_id` — `docs/DECISIONS/003-multi-tenancy-model.md`
- RLS strategy: JWT claims, default-deny, central super-admin helper, Phase-2 policy tests — `docs/DECISIONS/004-rls-strategy.md`
- English values in DB, Arabic labels in UI. No public signup for MVP.

---

## Phase 0 — Documentation & decisions ✅

- [x] PRD, database, permissions, UI/UX reviewed
- [x] Workflow confirmed: `missing → in_purchase → fulfilled`, `missing/in_purchase → cancelled`
- [x] No public signup; Arabic UI / English DB values confirmed
- [x] RLS strategy decided (`004`)

## Phase 1 — Project setup ✅

- [x] Initialize Next.js + TypeScript (Next 16, src/, `@/*` alias)
- [x] Install Tailwind CSS (v4)
- [x] Install shadcn/ui (button + `lib/utils` seeded)
- [x] Arabic RTL root layout (`lang=ar`, `dir=rtl`)
- [x] Add Tajawal font (owns `--font-sans` so shadcn base renders Arabic)
- [x] Route groups: `(auth)/login`, `(dashboard)/dashboard`
- [x] Basic AppShell (header + RTL nav)
- [x] **Exit:** build passes; `/login` + `/dashboard` render RTL Arabic; `/` → `/dashboard`

## Phase 2 — Supabase database foundation ✅

- [x] Create Supabase project (`ragzebvtqekhzwqccasv`, eu-west-1)
- [x] Migrations for core tables (`supabase/migrations/0001_core_schema`)
- [x] Constraints / checks
- [x] Indexes from `docs/DATABASE.md`
- [x] Enable RLS on all tenant tables (default-deny) — `0003`
- [x] Access-token hook writes `company_id`/`pharmacy_id`/`role`/`is_active` to JWT — `0002` + `config.toml`
- [x] RLS policies read claims via `auth.jwt()`; central `is_super_admin()` helper — `0003`
- [x] Workflow functions: `create_shortage_request`, `transition_shortage_status` (guarded compare-and-set) — `0004`
- [x] Seed data: company, pharmacy, admin/pharmacist/sales_rep, items, assignment — `seed.sql`
- [x] Policy-test suite (pgTAP) — `supabase/tests/rls_policies_test.sql` (11 assertions)
- [x] Apply to project — migrations pushed via session pooler; seed loaded
- [x] **Exit:** RLS blocks unauthorized access; **11/11 policy tests pass**; workflow functions write history
- [ ] ⚠️ Enable the JWT access-token hook in the dashboard (manual — Phase 3 prerequisite)

### Phase 2 handoff — one manual step before Phase 3

The hook **function** is deployed, but Supabase Auth won't call it until you toggle it on
(it's a GoTrue setting, not SQL, so it can't be pushed from here):

> Dashboard → **Authentication → Hooks → Customize Access Token (JWT) Claims** →
> enable, select schema `public`, function `custom_access_token_hook`.

Until that's on, logins won't carry `company_id`/`role` claims and every RLS policy will
deny — so Phase 3 login work depends on it.

**Reproducible DB workflow** (set `CONN` to the session-pooler URL first):
`npm run db:push` · `npm run db:seed` · `npm run db:test`

> Tests simulate each role via `request.jwt.claims` — no Docker; they run against the live DB.

## Phase 3 — Auth & protected app ✅

- [x] Supabase browser + server clients (`src/lib/supabase/{client,server}.ts`)
- [x] Login form (`(auth)/login`, server action in `(auth)/actions.ts`)
- [x] Protected route guard (`src/proxy.ts` — Next 16 proxy convention; refreshes session)
- [x] Load active profile after login (`src/lib/auth.ts`, RLS self-read)
- [x] Role-based navigation (dashboard layout shows name + role label)
- [x] Inactive / missing-profile error states (login action + layout both gate)
- [x] Logout (server action)
- [ ] Admin server action to create a tenant-bound profile (service role) — deferred to Phase 7 (admin screens); seeded users cover Phase 3–6
- [x] **Exit:** seeded user logs in; unauthorized → /login (307); inactive blocked; verified live

> Root cause fixed during Phase 3: seeded `auth.users` had NULL token columns →
> GoTrue "Database error querying schema" on every login. `seed.sql` now sets them to ''.

## Phase 4 — Item master data ✅

- [x] Items page with paginated list (`(dashboard)/items`, 20/page, RLS-scoped)
- [x] Search by Arabic name / barcode (PostgREST `or` ilike; filter chars stripped)
- [x] Create item dialog (`item-dialog.tsx`, `actions/items.ts` + zod)
- [x] Edit item dialog (admins; same dialog, edit mode)
- [x] Validation + duplicate-barcode handling (23505 → Arabic message)
- [ ] Item search combobox for request forms — deferred to Phase 5 (its only consumer is the request form built there)
- [x] **Exit:** verified live — list/search/pagination work; pharmacist write blocked by RLS (42501), not just hidden button; admin create/edit OK

## Phase 5 — Shortage workflow ⬜

- [ ] Active requests page with status tabs/filters
- [ ] Create shortage dialog → server action → `create_shortage_request`
- [ ] Request card/table components
- [ ] Status transition buttons → `transition_shortage_status`
- [ ] Status history on request detail
- [ ] Friendly Arabic toasts / errors
- [ ] **Exit:** pharmacist creates request; sales rep sees assigned; status changes; history records transitions

## Phase 6 — Dashboard & realtime ⬜

- [ ] Dashboard summary cards (counts by status)
- [ ] Active requests by status
- [ ] Quick filters
- [ ] Revalidation after actions
- [ ] Narrowly-scoped realtime only where useful (no broad subscriptions)
- [ ] **Exit:** clear operational view; no over-fetching of history

## Phase 7 — Admin screens ⬜

- [ ] Pharmacies page
- [ ] Users page
- [ ] Sales-rep assignments page
- [ ] Activate / deactivate user + pharmacy
- [ ] Role restrictions + validation
- [ ] **Exit:** admin manages users/pharmacies/assignments; sales-rep visibility follows assignments

## Phase 8 — Testing, security, deployment ⬜

- [ ] Unit tests (validation, status mapping)
- [ ] Integration tests (permissions, workflow functions)
- [ ] Playwright smoke flows
- [ ] Arabic RTL tested on mobile sizes (iOS Safari, Android Chrome)
- [ ] No service role key in client; serverless uses transaction pooler — `docs/DEPLOYMENT.md`
- [ ] Deploy to Vercel + Supabase staging
- [ ] Production readiness checklist (`docs/DEPLOYMENT.md`)
- [ ] **Exit:** staging works end-to-end; permission tests pass; mobile UX acceptable

## Phase 9 — SaaS hardening (post-MVP) ⬜

- [ ] Stripe billing
- [ ] User invitations
- [ ] Email notifications (Resend)
- [ ] Advanced reports + CSV/Excel export
- [ ] Monitoring (Sentry) / analytics (PostHog)
- [ ] AI features (cost/caching controls only)

---

## Open questions / risks

- [ ] JWT custom-claims hook vs `SECURITY DEFINER` helper for reading `role`/`company_id` — confirm approach in Phase 2 (`004`).
- [ ] Multi-rep pharmacies: `create_shortage_request` leaves `assigned_to` null when >1 active assignment — confirm this is the desired UX.

## Changelog

- 2026-06-28 — Phase 4 closed; items master (list/search/pagination, admin create+edit dialogs, zod validation, dup-barcode 23505 handling). Verified live: RLS blocks pharmacist writes (42501), search filters, admin CRUD works. Combobox deferred to Phase 5. zod + shadcn dialog/input/label added.
- 2026-06-28 — Phase 3 closed; Supabase SSR clients, login/logout server actions, proxy route guard, profile gate, role-aware nav. Verified live: login 200, unauth→login 307, JWT custom claims present. Fixed NULL-token seed bug.
- 2026-06-27 — Phase 2 closed; migrations pushed to live project (eu-west-1), seed loaded, 11/11 RLS/workflow policy tests pass via Docker-free `npm run db:test`. Manual step left: enable the Auth JWT hook in the dashboard.
- 2026-06-27 — Phase 2 started; full DB-as-code written (schema/JWT hook/RLS/functions/seed/pgTAP). Awaiting a Supabase project to apply + test.
- 2026-06-27 — Phase 1 closed; Next 16 + Tailwind v4 + shadcn scaffolded at repo root, RTL Arabic shell, route groups, build + runtime smoke green.
- 2026-06-27 — Phase 0 closed; decisions `001`–`004` locked; progress file created.
