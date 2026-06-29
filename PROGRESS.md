# Build Progress — Baraa (براء)

Living checklist for building the app. Update the status emoji and tick tasks as you go. Source of truth for *what* to build is `planning/mvp_plan.md`; this file tracks *where we are*.

**Legend:** ⬜ not started · 🟡 in progress · ✅ done · ⛔ blocked

**Last updated:** 2026-06-29

## Status at a glance

| Phase | Title | Status |
|---|---|---|
| 0 | Documentation & decisions | ✅ |
| 1 | Project setup | ✅ |
| 2 | Supabase database foundation | ✅ |
| 3 | Auth & protected app | ✅ |
| 4 | Item master data | ✅ |
| 5 | Shortage workflow | ✅ |
| 6 | Dashboard & realtime | ✅ |
| 7 | Admin screens | ✅ |
| 8 | Testing, security, deployment | ✅ |
| 9 | SaaS hardening (post-MVP) | ⬜ |

**Now:** 🚀 MVP **LIVE in production** — https://baraa-red.vercel.app (Vercel, `omars-projects-2185f46c/baraa`). All 8 MVP phases done. Remaining follow-ups: **rotate the leaked DB password + service-role key**, real-device mobile testing, then Phase 9 (post-MVP SaaS hardening).

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

## Phase 5 — Shortage workflow ✅

- [x] Active requests page with status tabs/filters (`(dashboard)/requests`)
- [x] Create shortage dialog → `create_shortage_request` (with item combobox, deferred from Phase 4)
- [x] Request card components + detail page (`requests/[id]`)
- [x] Status transition buttons → `transition_shortage_status` (role+status aware, `lib/workflow.ts`)
- [x] Status history timeline on request detail
- [x] Friendly Arabic toasts (sonner) / errors
- [x] **Exit:** verified live — pharmacist creates → auto-assigned to rep → rep runs missing→in_purchase→fulfilled; history records the sequence; pharmacist blocked from rep-only transitions; compare-and-set rejects stale writes

> Bug found & fixed in Phase 5: `transition_shortage_status` used SQLSTATE `40001`
> for compare-and-set rejection, but PostgREST auto-retries the serialization-failure
> class → the call hung. Changed to `55000` (object_not_in_prerequisite_state),
> non-retryable. Migration, app mapping, and pgTAP assertion all updated.

## Phase 6 — Dashboard & realtime ✅

- [x] Dashboard summary cards (head-counts by status, RLS-scoped, no rows pulled)
- [x] Active requests list (missing + in_purchase, limit 8)
- [x] Quick filters (cards link to `/requests?status=…`)
- [x] Revalidation after actions (dashboard is dynamic → fresh counts every load)
- [ ] Narrowly-scoped realtime — deferred: dashboard re-renders on every navigation, so counts are already current; revisit if live-without-navigation becomes a real need (avoid broad subscriptions per ARCHITECTURE §9)
- [x] **Exit:** clear operational view; counts via head-only queries (no over-fetch); verified live (missing=1 reflected after a create)

## Phase 7 — Admin screens ✅

- [x] Pharmacies page (list + create/edit dialog)
- [x] Users page (list + create via service role + role/pharmacy)
- [x] Sales-rep assignments page (add + remove)
- [x] Activate / deactivate user + pharmacy (no self-deactivate)
- [x] Role restrictions (`getAdminProfile` gate in nav, page redirect, every action) + zod validation
- [x] Admin create-user server action (service role) — deferred from Phase 3, now done (`actions/users.ts`, `lib/supabase/admin.ts`)
- [x] **Exit:** verified live — admin reaches all 3 pages (200), pharmacist redirected (307) with no admin nav links; service-role create → new user logs in with correct JWT claims, RLS-scoped

## Phase 8 — Testing, security, deployment ✅

- [x] Unit tests (`test/workflow.test.ts`, node:test, 5/5 — transition rules + labels)
- [x] Integration tests — `npm run test:workflow` (8/8, live, self-cleaning) + `npm run db:test` (pgTAP 11/11)
- [x] No service role key in client — verified server-only import + not in `.next` bundle; serverless pooler noted in DEPLOYMENT.md
- [ ] Playwright smoke flows — deferred (HTTP-level cookie smoke covers login→create→transition; full browser suite is post-MVP)
- [ ] Arabic RTL on real mobile (iOS Safari, Android Chrome) — manual, needs your devices
- [x] Deploy to Vercel — **LIVE**: https://baraa-red.vercel.app (env vars set for prod+preview; GitHub auto-deploy connected)
- [ ] Production readiness checklist (`docs/DEPLOYMENT.md`) — partial: build/RLS/no-client-secret/pooler ✓; key rotation + real-device mobile pending
- [x] **Exit:** production reachable; `/login` 200 RTL; unauth → /login 307 (proxy works in prod)

### Phase 8 handoff — deploy (needs your Vercel account)

1. Push is already on GitHub (`precatfa-creator/baraa`). In Vercel: **New Project → import the repo** (framework auto-detects Next.js).
2. Add env vars (Project Settings → Environment Variables) — values in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — do NOT prefix NEXT_PUBLIC)
3. In Supabase → Authentication → URL Configuration, add the Vercel domain to redirect/site URLs.
4. Deploy. Then run the readiness checklist in `docs/DEPLOYMENT.md` against the live URL.
5. ⚠️ Still pending: rotate the DB password + service-role key (both were shared in chat), update `.env.local` and Vercel.

> Tag for first real production deploy: **v1.0.0** (this milestone is v0.9.0 — code-complete, tested, deploy-ready).

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

- 2026-06-29 — 🚀 v1.0.0 — MVP deployed to production at https://baraa-red.vercel.app (Vercel). Public URL works: login renders RTL, route protection active. Pending: rotate leaked keys, mobile device testing.
- 2026-06-29 — Phase 8 (partial); test suite formalized (unit 5/5 via node:test, workflow 8/8, pgTAP 11/11) + security pass (service key server-only, not in client bundle). Remaining: Vercel deploy + mobile manual (need user). MVP feature-complete.
- 2026-06-29 — Phase 7 closed; admin screens (pharmacies/users/assignments) with service-role create-user (closes Phase 3 deferral). Admin-gated in nav + page redirect + RLS. Verified live: page gating + create-user→login→claims→RLS.
- 2026-06-29 — Phase 6 closed; dashboard with status-count cards (head-only counts) linking to filtered request lists + active-requests list. Realtime deferred (dynamic page stays fresh). Verified live.
- 2026-06-29 — Phase 5 closed; full shortage workflow UI (status tabs, create dialog + item combobox, transition buttons, history timeline, sonner toasts) on the Phase 2 RPCs. Verified live 8/8 + pgTAP 11/11. Fixed 40001→55000 PostgREST auto-retry hang.
- 2026-06-28 — Phase 4 closed; items master (list/search/pagination, admin create+edit dialogs, zod validation, dup-barcode 23505 handling). Verified live: RLS blocks pharmacist writes (42501), search filters, admin CRUD works. Combobox deferred to Phase 5. zod + shadcn dialog/input/label added.
- 2026-06-28 — Phase 3 closed; Supabase SSR clients, login/logout server actions, proxy route guard, profile gate, role-aware nav. Verified live: login 200, unauth→login 307, JWT custom claims present. Fixed NULL-token seed bug.
- 2026-06-27 — Phase 2 closed; migrations pushed to live project (eu-west-1), seed loaded, 11/11 RLS/workflow policy tests pass via Docker-free `npm run db:test`. Manual step left: enable the Auth JWT hook in the dashboard.
- 2026-06-27 — Phase 2 started; full DB-as-code written (schema/JWT hook/RLS/functions/seed/pgTAP). Awaiting a Supabase project to apply + test.
- 2026-06-27 — Phase 1 closed; Next 16 + Tailwind v4 + shadcn scaffolded at repo root, RTL Arabic shell, route groups, build + runtime smoke green.
- 2026-06-27 — Phase 0 closed; decisions `001`–`004` locked; progress file created.
