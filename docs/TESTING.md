# Testing Strategy

## 1. Testing goals

Prove that:

- Auth/protected routes work.
- RLS prevents cross-company access.
- Permissions match the role matrix.
- Workflow transitions are valid and audited.
- UI works on mobile and desktop.
- Arabic RTL layout is stable.

## 2. Test layers

### Unit tests

Test:

- status label mapping
- validation schemas
- permission helper functions
- formatting utilities

### Integration tests

Test:

- server actions
- database functions
- RLS policies using test users
- item and shortage creation

### E2E tests

Recommended tool: Playwright.

Test flows:

1. Pharmacist logs in and creates shortage request.
2. Sales rep logs in and sees assigned request.
3. Sales rep changes status to in_purchase.
4. Sales rep changes status to fulfilled.
5. Pharmacist sees updated status.
6. Unauthorized user cannot see another company request.

## 3. Manual device testing

Because the UI is mobile-first, test on:

- iPhone Safari.
- Android Chrome.
- Desktop Chrome.
- Desktop Safari/Edge if available.

## 4. CI checks

Run before deployment:

- typecheck
- lint
- unit tests
- Playwright smoke tests

Example commands later:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```
