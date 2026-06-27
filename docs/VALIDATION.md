# Validation

## 1. Validation layers

Use validation at multiple layers:

1. UI form hints.
2. Zod validation in server actions/API routes.
3. PostgreSQL constraints/checks.
4. RLS/function permission checks.

## 2. General rules

- Required fields must be explicit.
- Empty strings should become null where appropriate.
- IDs must be UUIDs.
- Quantity must be positive.
- Status must be one of allowed values.
- Role must be one of allowed values.

## 3. Item validation

Fields:

- `name_ar`: required, 2–200 chars.
- `name_en`: optional, max 200 chars.
- `barcode`: optional, max 64 chars, unique per company when present.
- `sku`: optional, max 64 chars.
- `category`: optional, max 100 chars.
- `unit`: optional, max 50 chars.

## 4. Shortage request validation

Fields:

- `item_id`: required UUID.
- `pharmacy_id`: required UUID.
- `quantity`: required positive number, default 1.
- `priority`: low/normal/high/urgent.
- `notes`: optional max 1000 chars.

Rules:

- Item must belong to same company.
- Pharmacy must belong to same company.
- Pharmacist can create only for their pharmacy unless admin.
- Sales rep creation is disabled in MVP unless explicitly allowed.

## 5. Status transition validation

Rules:

- New status must be allowed.
- Transition must be valid from current status.
- User role must allow transition.
- Sales rep must be assigned to the pharmacy.
- Insert history row for every status change.

## 6. User validation

- `full_name`: required, 2–120 chars.
- `role`: required role enum.
- `company_id`: required except platform super admin.
- `pharmacy_id`: required for pharmacist.
- `pharmacy_id`: optional for sales rep/admin.
- `phone`: optional, validated later if needed.
