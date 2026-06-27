# Decision 001 — Tech Stack

## Decision

Use:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase Auth
- Supabase PostgreSQL
- Supabase RLS
- Vercel

## Reason

This stack is strong for a SaaS dashboard with Arabic RTL UI, roles, workflows, authentication, and PostgreSQL-backed multi-tenancy.

## Alternatives considered

### Astro + Vue

Good for marketing sites, blogs, and static pages. Less ideal as the primary logged-in SaaS dashboard.

### Nuxt + Vue

Good Vue-based alternative. If Vue is strongly preferred, Nuxt 3 + Supabase is the recommended Vue route.

## Important note

The stack itself is not the expected bottleneck. The limiting factor will be architecture, schema, permissions, indexes, pagination, and clean separation of business logic.
