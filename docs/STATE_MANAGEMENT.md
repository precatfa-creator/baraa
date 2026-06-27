# State Management

## 1. Principle

Keep state simple. Baraa is mostly server/database-driven.

## 2. Recommended approach

- Server Components for initial data loading.
- Server Actions for mutations.
- Local React state for form/dialog UI.
- Supabase client only for session/realtime/simple reads where appropriate.
- Avoid unnecessary global state libraries in MVP.

## 3. Data flow

```text
User action → Client component → Server action → DB function/RLS → Revalidate page/list → UI updates
```

## 4. Caching

MVP:

- Use Next.js revalidation after mutations.
- Avoid caching permission-sensitive data incorrectly.

Later:

- Cache dashboard summary counts if expensive.
- Cache report results.
- Use pagination and query filters before adding caching complexity.

## 5. Realtime

Use realtime carefully:

- Subscribe only to active requests.
- Filter by relevant company/pharmacy where possible.
- Avoid subscribing every client to all rows.
- Do not use realtime for reports/history by default.
