# Baraa (براء)

Baraa is an internal pharmacy shortage-management SaaS. It connects pharmacists and sales representatives so missing medicines/products can be registered, followed up, purchased, and marked as fulfilled with minimal friction.

## Product summary

- Arabic RTL web app.
- Clean, modern, mobile-first UI.
- SaaS-ready multi-tenant architecture.
- Core master data: users and items.
- Core workflow: shortage request lifecycle.
- Core roles: Super Admin, Company Admin, Pharmacist, Sales Rep.

## Recommended stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- PostgreSQL functions/triggers for critical workflow logic
- Vercel for frontend deployment
- Supabase for database/auth/realtime

## Architecture principle

The stack is not expected to be the bottleneck. Application architecture and database design are the key risks.

Important rules:

- Do not put important business logic only in the Supabase client.
- UI components should display data and collect input, not enforce business rules alone.
- Use Next.js server actions/API routes for validation and orchestration.
- Use PostgreSQL RLS for tenant isolation and row access.
- Use PostgreSQL functions/triggers for workflow transitions and audit history.
- Design the schema, indexes, permissions, and pagination from the beginning.

## Documentation map

- `docs/PRD.md` — product requirements.
- `docs/FEATURES.md` — feature list and status.
- `docs/ARCHITECTURE.md` — system architecture.
- `docs/DATABASE.md` — PostgreSQL schema and indexes.
- `docs/API.md` — server actions/API contracts.
- `docs/UI_UX.md` — Arabic RTL design direction.
- `docs/COMPONENTS.md` — reusable UI components.
- `docs/AUTH.md` — authentication model.
- `docs/PERMISSIONS.md` — role matrix.
- `docs/VALIDATION.md` — validation rules.
- `docs/ERROR_HANDLING.md` — error strategy.
- `docs/SECURITY.md` — security model.
- `docs/TESTING.md` — testing strategy.
- `docs/DEPLOYMENT.md` — deployment plan.
- `docs/ROADMAP.md` — product roadmap.
- `planning/` — implementation phases, milestones, backlog.
- `design/` — sitemap, user flows, design system, wireframes.

## Implementation phases

1. Phase 0 — Product and architecture foundation.
2. Phase 1 — Project setup and design system.
3. Phase 2 — Supabase schema, RLS, and seed data.
4. Phase 3 — Auth, profiles, roles, and protected routing.
5. Phase 4 — Item master data.
6. Phase 5 — Shortage workflow.
7. Phase 6 — Dashboard, filtering, and realtime.
8. Phase 7 — Admin screens and assignments.
9. Phase 8 — Validation, security, testing, and deployment.
10. Phase 9 — SaaS hardening and future features.

Start from `planning/mvp_plan.md`.
# baraa
