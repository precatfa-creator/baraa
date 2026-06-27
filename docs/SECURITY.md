# Security

## 1. Security principles

- Never trust the frontend alone.
- Enforce tenant isolation with RLS.
- Use server actions/API routes for important mutations.
- Use database functions for workflow transitions.
- Keep secrets outside the repository.
- Preserve audit history.

## 2. RLS

RLS must be enabled on tenant-owned tables.

Policies should verify:

- user is authenticated
- profile exists
- profile is active
- company_id matches
- role permits the action
- pharmacy assignment permits access where relevant

## 3. Secrets

Use environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` only server-side when absolutely needed

Never expose service role key to client components.

## 4. Audit

Must record:

- status changes
- user who changed status
- timestamp
- optional note/reason

Do not hard-delete important operational data unless legally required.

## 5. Rate limiting

MVP:

- Basic Supabase/Auth limits.

Later:

- Rate limit login attempts.
- Rate limit API endpoints.
- Protect expensive reports/imports/AI features.

## 6. AI feature warning

If AI features are added later:

- Do not send sensitive customer data unnecessarily.
- Batch/cached calls.
- Keep AI out of critical workflow path unless reviewed.
- Log costs and failures.
