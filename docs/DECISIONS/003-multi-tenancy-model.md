# Decision 003 — Multi-Tenancy Model

## Decision

Use `companies` as the SaaS tenant root. Most operational tables include `company_id`. Pharmacy-specific records include `pharmacy_id`.

## Reason

This supports future SaaS expansion without rebuilding the schema.

## Core tenant-owned tables

- companies
- pharmacies
- profiles
- items
- shortage_requests
- shortage_status_history
- sales_rep_assignments

## Security

RLS policies must enforce company isolation and pharmacy/assignment visibility.
