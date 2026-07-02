-- Permanent delete of items by company_admin (manager) / super_admin, same company.
-- Soft-delete (is_active) stays the default; this is the hard-delete escape hatch.
-- shortage_requests.item_id references items with no ON DELETE, so deleting an item
-- that is used in any request raises 23503 — the app surfaces that as a friendly error.
create policy items_admin_delete on public.items
  for delete to authenticated
  using (
    is_super_admin()
    or (is_active_user() and app_role() = 'company_admin' and company_id = app_company_id())
  );
