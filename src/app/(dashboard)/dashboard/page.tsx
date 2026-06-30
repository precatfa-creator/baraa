import Link from "next/link";
import { AlertTriangle, ShoppingCart, CheckCircle2, XCircle, PackageX, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { statusLabel, statusBadgeClass, type Status } from "@/lib/workflow";

const STATUSES: Status[] = ["missing", "in_purchase", "fulfilled", "cancelled"];

const statusIcon: Record<Status, LucideIcon> = {
  missing: AlertTriangle,
  in_purchase: ShoppingCart,
  fulfilled: CheckCircle2,
  cancelled: XCircle,
  not_found: PackageX,
};

type ActiveRow = {
  id: string;
  status: Status;
  quantity: number;
  items: { name_ar: string } | null;
  pharmacies: { name: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // One head-count per status (no rows pulled); all RLS-scoped to the viewer.
  const counts = await Promise.all(
    STATUSES.map((s) =>
      supabase.from("shortage_requests").select("id", { count: "exact", head: true }).eq("status", s),
    ),
  );
  const countByStatus = Object.fromEntries(
    STATUSES.map((s, i) => [s, counts[i].count ?? 0]),
  ) as Record<Status, number>;

  const { data: active } = await supabase
    .from("shortage_requests")
    .select("id, status, quantity, items(name_ar), pharmacies(name)")
    .in("status", ["missing", "in_purchase"])
    .order("created_at", { ascending: false })
    .limit(8);
  const recent = (active ?? []) as unknown as ActiveRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">لوحة التحكم</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUSES.map((s) => {
          const Icon = statusIcon[s];
          return (
            <Link
              key={s}
              href={`/requests?status=${s}`}
              className="glass-panel glass-hover p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{countByStatus[s]}</span>
                <Icon className="size-5 text-primary" />
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{statusLabel[s]}</div>
            </Link>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">النواقص النشطة</h2>
          <Link href="/requests" className="text-sm text-muted-foreground hover:underline">
            عرض الكل
          </Link>
        </div>
        {recent.map((r) => (
          <Link
            key={r.id}
            href={`/requests/${r.id}`}
            className="glass-panel glass-hover flex items-center justify-between p-3"
          >
            <span className="text-sm">
              {r.items?.name_ar ?? "—"}
              <span className="text-muted-foreground"> · {r.pharmacies?.name}</span>
            </span>
            <span className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass[r.status]}`}>
              {statusLabel[r.status]}
            </span>
          </Link>
        ))}
        {recent.length === 0 && (
          <p className="glass-panel p-6 text-center text-muted-foreground">
            لا توجد نواقص نشطة.
          </p>
        )}
      </div>
    </div>
  );
}
