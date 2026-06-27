# Deployment

## 1. Environments

Recommended:

- local
- staging
- production

## 2. Hosting

Frontend:

- Vercel

Backend/database/auth:

- Supabase

## 3. Environment variables

Frontend/client-safe:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Server-only:

```text
SUPABASE_SERVICE_ROLE_KEY=
```

Only use service role key in safe server-only code.

## 4. Deployment flow

MVP:

1. Push to GitHub.
2. Vercel deploys preview branch.
3. Supabase migrations are applied to staging.
4. Run smoke tests.
5. Promote to production.

## 5. Database migrations

Use Supabase migrations.

Recommended folders later:

```text
supabase/migrations/
supabase/seed.sql
```

## 6. Production readiness checklist

- RLS enabled.
- No service role key in client.
- Indexes added.
- Pagination implemented.
- Auth redirects tested.
- Cross-company access tested.
- Error messages are user-friendly.
- Backups enabled in Supabase plan when needed.
