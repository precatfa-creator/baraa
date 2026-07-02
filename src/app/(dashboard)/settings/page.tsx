import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteRequests,
  deleteBatches,
  deleteItems,
  deletePharmacies,
  deleteUsers,
  KEEP_EMAIL,
} from "@/actions/admin-reset";
import { BulkDeleteDialog, type Row } from "./bulk-delete-dialog";

// Embedded to-one relations come back as an object (or array in some typings) — read loosely.
const one = (rel: unknown, key: string): string => {
  const r = Array.isArray(rel) ? rel[0] : rel;
  return (r as Record<string, string> | null)?.[key] ?? "—";
};
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("ar-EG-u-nu-latn", { dateStyle: "medium" });

const STATUS: Record<string, string> = {
  missing: "ناقص",
  in_purchase: "قيد الشراء",
  fulfilled: "مُلبّى",
  cancelled: "ملغى",
  open: "مفتوحة",
  in_market: "في السوق",
  closed: "مغلقة",
};

export default async function SettingsPage() {
  const admin = await getAdminProfile();
  if (!admin) redirect("/dashboard");

  // Global scope, all tenants (see admin-reset.ts). Service role bypasses RLS.
  // ponytail: loads every row into the modal — fine at this scale; paginate if it grows.
  const svc = createAdminClient();
  const [itemsRes, pharmaciesRes, requestsRes, batchesRes, profilesRes, authRes] = await Promise.all([
    svc.from("items").select("id, name_ar, barcode").order("name_ar"),
    svc.from("pharmacies").select("id, name").order("name"),
    svc
      .from("shortage_requests")
      .select("id, status, created_at, items(name_ar), pharmacies(name)")
      .order("created_at", { ascending: false }),
    svc
      .from("batches")
      .select("id, status, created_at, pharmacies(name)")
      .order("created_at", { ascending: false }),
    svc.from("profiles").select("id, full_name, role"),
    svc.auth.admin.listUsers({ page: 1, perPage: 200 }),
  ]);

  const itemRows: Row[] = (itemsRes.data ?? []).map((i) => ({
    id: i.id,
    label: i.barcode ? `${i.name_ar} — ${i.barcode}` : i.name_ar,
  }));

  const pharmacyRows: Row[] = (pharmaciesRes.data ?? []).map((p) => ({ id: p.id, label: p.name }));

  const requestRows: Row[] = (requestsRes.data ?? []).map((r) => ({
    id: r.id,
    label: `${one(r.items, "name_ar")} — ${one(r.pharmacies, "name")} — ${STATUS[r.status] ?? r.status} — ${fmtDate(r.created_at)}`,
  }));

  const batchRows: Row[] = (batchesRes.data ?? []).map((b) => ({
    id: b.id,
    label: `${one(b.pharmacies, "name")} — ${STATUS[b.status] ?? b.status} — ${fmtDate(b.created_at)}`,
  }));

  // Users: join auth emails with profile names/roles; exclude the protected accounts.
  const nameById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const userRows: Row[] = (authRes.data?.users ?? [])
    .filter((u) => u.email !== KEEP_EMAIL && u.id !== admin.id)
    .map((u) => {
      const p = nameById.get(u.id);
      return { id: u.id, label: `${p?.full_name ?? "—"} — ${u.email ?? "—"}` };
    });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الإعدادات</h1>

      <section className="glass-panel space-y-4 border-destructive/40 p-4">
        <div>
          <h2 className="text-base font-semibold text-destructive">منطقة الخطر</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            افتح أي نوع لتُعرض بياناته محدَّدة بالكامل، ثم ألغِ تحديد ما تريد الاحتفاظ به. احذف بالترتيب:
            الطلبات ثم الدفعات ثم الأصناف والصيدليات ثم المستخدمين.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <BulkDeleteDialog label="حذف الطلبات" rows={requestRows} successMsg="تم حذف الطلبات" action={deleteRequests} />
          <BulkDeleteDialog label="حذف الدفعات" rows={batchRows} successMsg="تم حذف الدفعات" action={deleteBatches} />
          <BulkDeleteDialog label="حذف الأصناف" rows={itemRows} successMsg="تم حذف الأصناف" action={deleteItems} />
          <BulkDeleteDialog label="حذف الصيدليات" rows={pharmacyRows} successMsg="تم حذف الصيدليات" action={deletePharmacies} />
          <BulkDeleteDialog
            label="حذف المستخدمين (عدا omar@baraa.ly)"
            rows={userRows}
            successMsg="تم حذف المستخدمين"
            action={deleteUsers}
          />
        </div>
      </section>
    </div>
  );
}
