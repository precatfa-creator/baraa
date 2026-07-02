import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, PackageCheck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { statusBadgeClass, statusLabel, type Status } from "@/lib/workflow";

type RequestRow = {
  id: string;
  status: Status;
  created_at: string;
  fulfilled_at: string | null;
  purchase_source: string | null;
  pharmacies: { name: string } | null;
  batches: {
    code: string;
    status: string;
    taken_at: string | null;
    profiles: { full_name: string } | null;
  } | null;
};

type RequesterRow = {
  shortage_request_id: string;
  created_at: string;
  profiles: { full_name: string } | null;
};

type PurchaseEventRow = {
  id: string;
  shortage_request_id: string;
  started_at: string | null;
  purchased_at: string;
  reversed_at: string | null;
  purchase_source: string | null;
  profiles: { full_name: string; role: string } | null;
  batches: { code: string } | null;
};

const WINDOW_DAYS: Record<string, number | null> = { "30": 30, "90": 90, all: null };

export default async function ItemTrendLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ window?: string }>;
}) {
  const [{ itemId }, { window: requestedWindow }] = await Promise.all([params, searchParams]);
  const selectedWindow = requestedWindow && requestedWindow in WINDOW_DAYS ? requestedWindow : "90";
  const days = WINDOW_DAYS[selectedWindow];
  const supabase = await createClient();

  let requestQuery = supabase
    .from("shortage_requests")
    .select(
      "id, status, created_at, fulfilled_at, purchase_source, pharmacies(name), batches(code, status, taken_at, profiles!batches_taken_by_fkey(full_name))",
    )
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });
  // Server-request cutoff; it is intentionally evaluated once for this report render.
  // eslint-disable-next-line react-hooks/purity
  if (days) requestQuery = requestQuery.gte("created_at", new Date(Date.now() - days * 864e5).toISOString());

  const [{ data: item }, { data: requestData }] = await Promise.all([
    supabase.from("items").select("id, name_ar, category").eq("id", itemId).maybeSingle(),
    requestQuery,
  ]);
  if (!item) notFound();

  const requests = (requestData ?? []) as unknown as RequestRow[];
  const requestIds = requests.map((request) => request.id);
  let requesters: RequesterRow[] = [];
  let purchases: PurchaseEventRow[] = [];
  if (requestIds.length) {
    const [{ data: requesterData }, { data: purchaseData }] = await Promise.all([
      supabase
        .from("shortage_request_requesters")
        .select(
          "shortage_request_id, created_at, profiles!shortage_request_requesters_profile_id_fkey(full_name)",
        )
        .in("shortage_request_id", requestIds)
        .order("created_at", { ascending: true }),
      supabase
        .from("purchase_events")
        .select(
          "id, shortage_request_id, started_at, purchased_at, reversed_at, purchase_source, profiles!purchase_events_buyer_id_fkey(full_name, role), batches(code)",
        )
        .in("shortage_request_id", requestIds)
        .order("purchased_at", { ascending: true }),
    ]);
    requesters = (requesterData ?? []) as unknown as RequesterRow[];
    purchases = (purchaseData ?? []) as unknown as PurchaseEventRow[];
  }

  const requestersByRequest = groupBy(requesters, (row) => row.shortage_request_id);
  const purchasesByRequest = groupBy(purchases, (row) => row.shortage_request_id);
  const activePurchases = purchases.filter((purchase) => !purchase.reversed_at);

  return (
    <div className="space-y-5">
      <Link
        href={`/trends?window=${selectedWindow}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← العودة إلى الأكثر طلبًا
      </Link>

      <div>
        <h1 className="text-xl font-bold">سجل طلبات {item.name_ar}</h1>
        <p className="text-sm text-muted-foreground">{item.category ?? "بدون تصنيف"}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Summary label="مرات النقص" value={requests.length} />
        <Summary label="طلبات الصيادلة" value={requesters.length} />
        <Summary label="مرات الشراء" value={activePurchases.length} />
      </div>

      <div className="space-y-3">
        {requests.map((request) => {
          const requestRequesters = requestersByRequest.get(request.id) ?? [];
          const requestPurchases = purchasesByRequest.get(request.id) ?? [];
          return (
            <article key={request.id} className="glass-panel space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{request.pharmacies?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(request.created_at)}
                    {request.batches?.code ? ` · دفعة ${request.batches.code}` : ""}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass[request.status]}`}>
                  {statusLabel[request.status]}
                </span>
              </div>

              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <UserRound className="size-4 text-primary" />
                  الصيادلة الذين طلبوه
                </h2>
                <div className="flex flex-wrap gap-2">
                  {requestRequesters.map((requester, index) => (
                    <div key={`${requester.shortage_request_id}-${index}`} className="rounded-lg bg-muted/60 px-3 py-2 text-xs">
                      <div className="font-medium">{requester.profiles?.full_name ?? "—"}</div>
                      <div className="text-muted-foreground">{formatDateTime(requester.created_at)}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <PackageCheck className="size-4 text-green-600" />
                  سجل الشراء
                </h2>
                {requestPurchases.length ? (
                  <div className="space-y-2">
                    {requestPurchases.map((purchase) => (
                      <div key={purchase.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">
                            {purchase.profiles?.full_name ?? "—"}
                            {purchase.profiles?.role === "sales_rep" ? " · مندوب مبيعات" : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(purchase.purchased_at)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {purchase.batches?.code && <span>دفعة {purchase.batches.code}</span>}
                          {purchase.purchase_source && <span>الشراء من: {purchase.purchase_source}</span>}
                          {purchase.started_at && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3" />
                              {formatDuration(purchase.started_at, purchase.purchased_at)}
                            </span>
                          )}
                          {purchase.reversed_at && <span className="text-destructive">تم التراجع</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">لم يتم شراء هذا الطلب بعد.</p>
                )}
              </section>
            </article>
          );
        })}
        {requests.length === 0 && (
          <p className="glass-panel p-8 text-center text-muted-foreground">
            لا توجد طلبات لهذا الصنف في الفترة المحددة.
          </p>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(key(row), [...(grouped.get(key(row)) ?? []), row]);
  return grouped;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ar-EG-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(start: string, end: string): string {
  const minutes = Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (minutes < 60) return `${Math.round(minutes)} دقيقة`;
  return `${(minutes / 60).toFixed(1)} ساعة`;
}
