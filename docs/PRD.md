# Product Requirements Document — Baraa (براء)

## 1. Product vision

Baraa is a simple, clean, Arabic RTL SaaS platform for pharmacies to manage missing medicines and products. It connects pharmacists with sales representatives so shortages are recorded, tracked, purchased, and fulfilled without WhatsApp chaos, duplicate purchases, or forgotten items.

## 2. Problem

Pharmacies often track missing items manually or through scattered messages. This creates:

- Forgotten shortage items.
- Duplicate purchasing.
- No clear status for each item.
- Poor communication between pharmacist and sales rep.
- No history of who changed what.
- Difficulty scaling across branches.

## 3. Target users

### Pharmacist

Adds missing medicines/products, checks status, and confirms what remains missing.

### Sales Rep

Receives requests from assigned pharmacies, starts purchasing, and marks items as fulfilled.

### Company Admin

Manages company users, pharmacies, item master data, assignments, and reports.

### Super Admin

Platform owner/operator. Manages companies, subscriptions, support access, and system settings.

## 4. MVP goal

Build a working Arabic RTL web app where:

- Users can log in.
- Company/pharmacy data is isolated.
- Pharmacists can add shortage requests.
- Sales reps can see assigned requests.
- Status can move through a controlled workflow.
- Users can see clear dashboards and item lists.
- All critical access is protected by RLS/server logic.

## 5. Core workflow

1. Pharmacist opens the app.
2. Pharmacist searches/selects an item from master data.
3. Pharmacist adds a shortage request with quantity and optional notes.
4. Request status starts as `missing`.
5. Sales rep sees requests for assigned pharmacies.
6. Sales rep marks request as `in_purchase` when started.
7. Sales rep marks request as `fulfilled` when provided.
8. System records status history for audit.

Arabic UI labels:

- `missing` → `ناقص`
- `in_purchase` → `قيد الشراء`
- `fulfilled` → `تم توفيره`
- `cancelled` → `ملغي`

## 6. Business goals

- Reduce missed shortage items.
- Reduce duplicate purchases.
- Improve visibility between pharmacist and sales rep.
- Create a SaaS-ready foundation for multiple companies and pharmacies.
- Keep the app simple enough for daily use on phones.

## 7. Success metrics

MVP success:

- Pharmacist can add a shortage in under 20 seconds.
- Sales rep can update status in one tap/click.
- Active requests are clearly visible by status.
- Users only see data they are allowed to see.
- Database has tenant isolation using company_id and RLS.
- No critical business rule exists only in React client code.

Future SaaS metrics:

- Number of active pharmacies.
- Number of shortage requests per day.
- Average time from missing to fulfilled.
- Duplicate request rate.
- Monthly active users.
- Subscription conversion.

## 8. Non-goals for MVP

- Native mobile app.
- Stripe billing.
- WhatsApp integration.
- Complex ERP inventory integration.
- AI features.
- Advanced analytics.
- Complex approval workflow.

These can be added later after the core workflow is stable.
