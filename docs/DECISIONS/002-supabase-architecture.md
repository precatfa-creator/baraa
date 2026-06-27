# Decision 002 — Supabase Architecture

## Decision

Use Supabase as the secure backend/database layer, not only as a client-side database SDK.

## Rules

- Important business logic must not live only in React components.
- Use server actions/API routes for validation and orchestration.
- Use PostgreSQL RLS for tenant and role access.
- Use PostgreSQL functions/triggers for workflow transitions and audit history.
- Use Supabase client carefully for simple reads/session/realtime only.

## Reason

This prevents a messy prototype architecture and keeps the system SaaS-ready.
