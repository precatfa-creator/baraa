# API and Server Actions

## 1. API style

MVP should prefer Next.js server actions for app mutations. Add REST endpoints only where needed for integrations/webhooks.

## 2. Server action modules

```text
src/actions/items.ts
src/actions/requests.ts
src/actions/users.ts
src/actions/pharmacies.ts
src/actions/assignments.ts
```

## 3. Request actions

### createShortageRequest(input)

Input:

```ts
type CreateShortageRequestInput = {
  itemId: string
  pharmacyId: string
  quantity: number
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  notes?: string
}
```

Behavior:

- Validate input with Zod.
- Load current profile.
- Call database function `create_shortage_request`.
- Return created request id or normalized error.

### transitionShortageStatus(input)

Input:

```ts
type TransitionShortageStatusInput = {
  requestId: string
  newStatus: 'missing' | 'in_purchase' | 'fulfilled' | 'cancelled'
  note?: string
}
```

Behavior:

- Validate input.
- Call `transition_shortage_status` database function.
- Return updated request.

## 4. Item actions

### createItem(input)

Input:

```ts
type CreateItemInput = {
  nameAr: string
  nameEn?: string
  barcode?: string
  sku?: string
  category?: string
  unit?: string
}
```

## 5. API response shape

Use consistent action responses:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: Record<string, string[]> }
```

## 6. Future REST endpoints

Possible later endpoints:

```text
POST /api/webhooks/stripe
POST /api/integrations/import-items
GET  /api/public/health
```

## 7. Important rule

Do not expose broad database mutations directly from client components. Critical operations must pass through server actions and database policies/functions.
