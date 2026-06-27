# Permissions

## 1. Roles

- `super_admin` — platform operator.
- `company_admin` — manages one company/tenant.
- `pharmacist` — creates and follows shortage requests for their pharmacy.
- `sales_rep` — manages purchasing workflow for assigned pharmacies.

## 2. Permission matrix

| Action | Super Admin | Company Admin | Pharmacist | Sales Rep |
|---|---:|---:|---:|---:|
| View own company data | Yes | Yes | Yes | Yes |
| View all companies | Yes | No | No | No |
| Manage companies | Yes | No | No | No |
| Manage pharmacies in company | Support/Yes | Yes | No | No |
| Manage users in company | Support/Yes | Yes | No | No |
| View item master data | Yes | Yes | Yes | Yes |
| Create item | Yes | Yes | Optional | No |
| Edit item | Yes | Yes | No | No |
| Deactivate item | Yes | Yes | No | No |
| Create shortage request | Yes | Yes | Yes | Optional/No |
| View pharmacy shortage requests | Yes | Yes | Own pharmacy | Assigned pharmacies |
| Update request quantity/notes | Yes | Yes | Own request while missing | Assigned active requests notes only |
| Mark request in_purchase | Yes | Yes | No | Yes |
| Mark request fulfilled | Yes | Yes | No | Yes |
| Cancel request | Yes | Yes | Own request while missing | Assigned request with reason |
| View status history | Yes | Yes | Related own pharmacy | Assigned pharmacies |
| Manage sales rep assignments | Yes | Yes | No | No |
| View reports | Yes | Yes | Limited | Limited |

## 3. Tenant isolation

No user should access another company data unless they are `super_admin` performing support/platform operations.

Every RLS policy must start from:

- authenticated user id
- `profiles.id = auth.uid()`
- `profiles.company_id`
- role and active status

## 4. Pharmacy isolation

Pharmacists see:

- Their own profile.
- Items in their company.
- Requests for their `pharmacy_id`.

Sales reps see:

- Their own profile.
- Items in their company.
- Requests for pharmacies assigned to them in `sales_rep_assignments`.

Company admins see:

- All pharmacies, items, requests, users, and assignments inside their company.

## 5. Workflow permissions

Allowed transitions:

| Transition | Company Admin | Pharmacist | Sales Rep |
|---|---:|---:|---:|
| missing → in_purchase | Yes | No | Yes |
| in_purchase → fulfilled | Yes | No | Yes |
| missing → cancelled | Yes | Yes, own pharmacy | Yes, assigned pharmacy |
| in_purchase → cancelled | Yes | No | Yes, assigned pharmacy |
| fulfilled → missing | Admin only with reason | No | No |

## 6. UI versus enforcement

The UI may hide unavailable buttons, but security must be enforced by:

- RLS policies.
- Server actions/API routes.
- PostgreSQL functions.

Never trust button visibility alone.
