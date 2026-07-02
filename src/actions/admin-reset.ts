"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProfile } from "@/lib/auth";
import { KEEP_EMAIL } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/audit";

// Danger-zone bulk deletes for the Settings screen. Each action deletes the
// explicitly-selected ids (the UI shows a checked table; the admin unchecks what
// to keep). GLOBAL scope (all tenants), service-role client (bypasses RLS), gated
// on an active admin.
//
// FK constraints force an order: requests → batches → items/pharmacies → users.
// Each action clears the nullable references it can, and surfaces a clear Arabic
// error naming the prerequisite when a restrict FK (23503) blocks it.
// ponytail: global, unscoped — add a company_id filter if the app ever multi-tenants.

export type ResetResult = { ok: true; count: number } | { ok: false; error: string };

async function recordBulkDelete(
  actorId: string,
  companyId: string | null,
  entityType: string,
  ids: string[],
  count: number,
) {
  await recordAuditEvent(await createClient(), {
    eventType: "admin.bulk_delete",
    entityType,
    action: "bulk_delete",
    summary: `Administrator bulk deleted ${entityType}`,
    details: { selected_ids: ids, deleted_count: count },
    actorId,
    companyId,
  });
}

// Delete selected shortage requests (status history cascades).
export async function deleteRequests(ids: string[]): Promise<ResetResult> {
  const admin = await getAdminProfile();
  if (!admin) return { ok: false, error: "صلاحية غير كافية." };
  if (ids.length === 0) return { ok: true, count: 0 };
  const svc = createAdminClient();
  const { error, count } = await svc.from("shortage_requests").delete({ count: "exact" }).in("id", ids);
  if (error) {
    console.error("deleteRequests:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الطلبات." };
  }
  await recordBulkDelete(admin.id, admin.company_id, "shortage_requests", ids, count ?? 0);
  revalidatePath("/requests");
  return { ok: true, count: count ?? 0 };
}

// Delete selected batches. Detach requests (nullable batch_id) first.
export async function deleteBatches(ids: string[]): Promise<ResetResult> {
  const admin = await getAdminProfile();
  if (!admin) return { ok: false, error: "صلاحية غير كافية." };
  if (ids.length === 0) return { ok: true, count: 0 };
  const svc = createAdminClient();
  await svc.from("shortage_requests").update({ batch_id: null }).in("batch_id", ids);
  const { error, count } = await svc.from("batches").delete({ count: "exact" }).in("id", ids);
  if (error) {
    console.error("deleteBatches:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الدفعات." };
  }
  await recordBulkDelete(admin.id, admin.company_id, "batches", ids, count ?? 0);
  revalidatePath("/batches");
  return { ok: true, count: count ?? 0 };
}

// Delete selected items. Blocked while a request references one (item_id NOT NULL).
export async function deleteItems(ids: string[]): Promise<ResetResult> {
  const admin = await getAdminProfile();
  if (!admin) return { ok: false, error: "صلاحية غير كافية." };
  if (ids.length === 0) return { ok: true, count: 0 };
  const svc = createAdminClient();
  const { error, count } = await svc.from("items").delete({ count: "exact" }).in("id", ids);
  if (error) {
    if (error.code === "23503") return { ok: false, error: "احذف الطلبات المرتبطة أولًا ثم الأصناف." };
    console.error("deleteItems:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الأصناف." };
  }
  await recordBulkDelete(admin.id, admin.company_id, "items", ids, count ?? 0);
  revalidatePath("/items");
  return { ok: true, count: count ?? 0 };
}

// Delete selected pharmacies. Detach users + rep assignments; still blocked while
// requests/batches reference a pharmacy.
export async function deletePharmacies(ids: string[]): Promise<ResetResult> {
  const admin = await getAdminProfile();
  if (!admin) return { ok: false, error: "صلاحية غير كافية." };
  if (ids.length === 0) return { ok: true, count: 0 };
  const svc = createAdminClient();
  await svc.from("profiles").update({ pharmacy_id: null }).in("pharmacy_id", ids);
  await svc.from("sales_rep_assignments").delete().in("pharmacy_id", ids);
  const { error, count } = await svc.from("pharmacies").delete({ count: "exact" }).in("id", ids);
  if (error) {
    if (error.code === "23503") return { ok: false, error: "احذف الطلبات والدفعات المرتبطة أولًا ثم الصيدليات." };
    console.error("deletePharmacies:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الصيدليات." };
  }
  await recordBulkDelete(admin.id, admin.company_id, "pharmacies", ids, count ?? 0);
  revalidatePath("/pharmacies");
  return { ok: true, count: count ?? 0 };
}

// Delete selected users. Never deletes omar@baraa.ly or the acting admin, even if
// their id is passed. Deleting the auth user cascades its profile; that cascade is
// blocked while the profile is still referenced by requests/batches (restrict).
export async function deleteUsers(ids: string[]): Promise<ResetResult> {
  const admin = await getAdminProfile();
  if (!admin) return { ok: false, error: "صلاحية غير كافية." };
  const svc = createAdminClient();

  // Resolve protected ids server-side: the acting admin + whoever owns KEEP_EMAIL.
  const protectedIds = new Set<string>([admin.id]);
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    const keep = data.users.find((u) => u.email === KEEP_EMAIL);
    if (keep) protectedIds.add(keep.id);
    if (keep || data.users.length < 200) break;
  }

  const targets = ids.filter((id) => !protectedIds.has(id));
  if (targets.length === 0) return { ok: true, count: 0 };

  // items.created_by is nullable — detach so items don't block user deletion.
  await svc.from("items").update({ created_by: null }).in("created_by", targets);

  let deleted = 0;
  let blocked = false;
  for (const id of targets) {
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) blocked = true;
    else deleted++;
  }

  await recordBulkDelete(admin.id, admin.company_id, "profiles", targets, deleted);
  revalidatePath("/users");
  if (blocked) {
    return { ok: false, error: `حُذف ${deleted}. احذف الطلبات والدفعات المرتبطة أولًا لحذف الباقي.` };
  }
  return { ok: true, count: deleted };
}
