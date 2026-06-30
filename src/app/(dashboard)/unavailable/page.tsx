import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { RequeueControls, type UnavailableRow } from "./requeue-controls";

type Row = {
  id: string;
  quantity: number;
  items: { name_ar: string; category: string | null; unit: string | null } | null;
  pharmacies: { name: string } | null;
  shortage_request_requesters: { count: number }[];
};

export default async function UnavailablePage() {
  const profile = await getCurrentProfile();
  const role = profile?.role;
  const canHandle = role === "sales_rep" || role === "company_admin" || role === "super_admin";

  const supabase = await createClient();
  const { data } = await supabase
    .from("shortage_requests")
    .select(
      "id, quantity, items(name_ar, category, unit), pharmacies(name), shortage_request_requesters(count)",
    )
    .eq("status", "not_found")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: UnavailableRow[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    name: r.items?.name_ar ?? "—",
    category: r.items?.category ?? null,
    unit: r.items?.unit ?? null,
    quantity: r.quantity,
    pharmacy: r.pharmacies?.name ?? null,
    requesters: r.shortage_request_requesters?.[0]?.count ?? 1,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">غير المتوفرة</h1>
        <p className="text-sm text-muted-foreground">
          أصناف لم تُتوفر في السوق. اختر منها لإعادتها إلى الدفعة المفتوحة وطلبها مجددًا.
        </p>
      </div>
      <RequeueControls rows={rows} canHandle={canHandle} />
    </div>
  );
}
