"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProfile } from "@/lib/auth";

// Danger-zone bulk deletes for the Settings screen. GLOBAL scope (all tenants) —
// the app is effectively single-tenant and the user chose a global wipe. All ops
// use the service-role client (bypasses RLS) and are gated on an active admin.
//
// FK constraints force an order: requests → batches → items/pharmacies → users.
// Each action clears the nullable references it can, and surfaces a clear Arabic
// error naming the prerequisite when a restrict FK (23503) blocks it.
// ponytail: global, unscoped wipe — add a company_id filter here if the app ever
// serves more than one tenant.

export type ResetResult = { ok: true; count: number } | { ok: false; error: string };

const KEEP_EMAIL = "omar@baraa.ly";
// PostgREST needs a filter to delete; `id is not null` matches every row.

// Delete all shortage requests (+ their status history, which also cascades).
export async function deleteAllRequests(): Promise<ResetResult> {
  if (!(await getAdminProfile())) return { ok: false, error: "صلاحية غير كافية." };
  const svc = createAdminClient();
  await svc.from("shortage_status_history").delete().not("id", "is", null);
  const { error, count } = await svc
    .from("shortage_requests")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) {
    console.error("deleteAllRequests:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الطلبات." };
  }
  revalidatePath("/requests");
  return { ok: true, count: count ?? 0 };
}

// Delete all batches. Requests point at batches via a nullable batch_id — clear it first.
export async function deleteAllBatches(): Promise<ResetResult> {
  if (!(await getAdminProfile())) return { ok: false, error: "صلاحية غير كافية." };
  const svc = createAdminClient();
  await svc.from("shortage_requests").update({ batch_id: null }).not("batch_id", "is", null);
  const { error, count } = await svc.from("batches").delete({ count: "exact" }).not("id", "is", null);
  if (error) {
    console.error("deleteAllBatches:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الدفعات." };
  }
  revalidatePath("/batches");
  return { ok: true, count: count ?? 0 };
}

// Delete all items. Blocked while any request references an item (item_id is NOT NULL).
export async function deleteAllItems(): Promise<ResetResult> {
  if (!(await getAdminProfile())) return { ok: false, error: "صلاحية غير كافية." };
  const svc = createAdminClient();
  const { error, count } = await svc.from("items").delete({ count: "exact" }).not("id", "is", null);
  if (error) {
    if (error.code === "23503") return { ok: false, error: "احذف الطلبات أولًا ثم الأصناف." };
    console.error("deleteAllItems:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الأصناف." };
  }
  revalidatePath("/items");
  return { ok: true, count: count ?? 0 };
}

// Delete all pharmacies. Detach users (pharmacy_id nullable) and rep assignments first;
// still blocked while requests/batches reference a pharmacy.
export async function deleteAllPharmacies(): Promise<ResetResult> {
  if (!(await getAdminProfile())) return { ok: false, error: "صلاحية غير كافية." };
  const svc = createAdminClient();
  await svc.from("profiles").update({ pharmacy_id: null }).not("pharmacy_id", "is", null);
  await svc.from("sales_rep_assignments").delete().not("id", "is", null);
  const { error, count } = await svc.from("pharmacies").delete({ count: "exact" }).not("id", "is", null);
  if (error) {
    if (error.code === "23503") return { ok: false, error: "احذف الطلبات والدفعات أولًا ثم الصيدليات." };
    console.error("deleteAllPharmacies:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الصيدليات." };
  }
  revalidatePath("/pharmacies");
  return { ok: true, count: count ?? 0 };
}

// Delete all users except omar@baraa.ly and the acting admin (avoid self-lockout).
// Deleting the auth user cascades its profile; that cascade is blocked while the
// profile is still referenced by requests/batches (restrict), so delete those first.
export async function deleteAllUsers(): Promise<ResetResult> {
  const admin = await getAdminProfile();
  if (!admin) return { ok: false, error: "صلاحية غير كافية." };
  const svc = createAdminClient();

  // items.created_by is nullable — detach so items don't block user deletion.
  await svc.from("items").update({ created_by: null }).not("created_by", "is", null);

  let deleted = 0;
  let blocked = false;
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { ok: false, error: "تعذر قراءة المستخدمين." };
    const users = data.users;
    if (users.length === 0) break;
    for (const u of users) {
      if (u.email === KEEP_EMAIL || u.id === admin.id) continue;
      const { error: delErr } = await svc.auth.admin.deleteUser(u.id);
      if (delErr) blocked = true;
      else deleted++;
    }
    if (users.length < 200) break;
  }

  revalidatePath("/users");
  if (blocked) {
    return { ok: false, error: `حُذف ${deleted}. احذف الطلبات والدفعات أولًا لحذف الباقي.` };
  }
  return { ok: true, count: deleted };
}
