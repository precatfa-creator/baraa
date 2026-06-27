# Build Progress — Baraa (براء)

Living checklist for building the app. Update the status emoji and tick tasks as you go. Source of truth for *what* to build is `planning/mvp_plan.md`; this file tracks *where we are*.

**Legend:** ⬜ not started · 🟡 in progress · ✅ done · ⛔ blocked

**Last updated:** 2026-06-27

## Status at a glance

| Phase | Title | Status |
|---|---|---|
| 0 | Documentation & decisions | ✅ |
| 1 | Project setup | ✅ |
| 2 | Supabase database foundation | ⬜ |
| 3 | Auth & protected app | ⬜ |
| 4 | Item master data | ⬜ |
| 5 | Shortage workflow | ⬜ |
| 6 | Dashboard & realtime | ⬜ |
| 7 | Admin screens | ⬜ |
| 8 | Testing, security, deployment | ⬜ |
| 9 | SaaS hardening (post-MVP) | ⬜ |

**Now:** Phase 1 complete (app scaffolds, builds, RTL pages render). Next up: Phase 2 (Supabase schema, RLS, workflow functions).

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

## Phase 2 — Supabase database foundation ⬜

- [ ] Create Supabase project
- [ ] Migrations for core tables (`supabase/migrations/`)
- [ ] Constraints / checks
- [ ] Indexes from `docs/DATABASE.md`
- [ ] Enable RLS on all tenant tables (default-deny)
- [ ] Access-token hook writes `company_id` + `role` to JWT claims
- [ ] RLS policies read claims via `auth.jwt()`; central `is_super_admin()` helper
- [ ] Workflow functions: `create_shortage_request`, `transition_shortage_status` (guarded compare-and-set)
- [ ] Seed data: 1 company, 1 pharmacy, 1 pharmacist, 1 sales rep, sample items
- [ ] Seeded policy-test suite (pgTAP or equivalent)
- [ ] **Exit:** schema exists; RLS blocks unauthorized access; **policy tests pass**; workflow functions create history

## Phase 3 — Auth & protected app ⬜

- [ ] Supabase browser + server clients
- [ ] Login form
- [ ] Protected route middleware / server checks
- [ ] Load active profile after login
- [ ] Role-based navigation
- [ ] Inactive / missing-profile error states
- [ ] Logout
- [ ] Admin server action to create a tenant-bound profile (service role) — `docs/AUTH.md`
- [ ] **Exit:** each test user logs in; unauthorized redirected; inactive users blocked

## Phase 4 — Item master data ⬜

- [ ] Items page with paginated list
- [ ] Search by Arabic name / barcode
- [ ] Create item dialog
- [ ] Edit item dialog (admins)
- [ ] Validation + duplicate-barcode handling
- [ ] Item search combobox for request forms
- [ ] **Exit:** item master works; searches paginated/filterable; permissions enforced server/DB-side

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

- 2026-06-27 — Phase 1 closed; Next 16 + Tailwind v4 + shadcn scaffolded at repo root, RTL Arabic shell, route groups, build + runtime smoke green.
- 2026-06-27 — Phase 0 closed; decisions `001`–`004` locked; progress file created.
