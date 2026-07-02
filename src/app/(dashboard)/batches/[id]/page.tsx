import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { batchStatusLabel, batchStatusBadgeClass, type BatchStatus, type Status } from "@/lib/workflow";
import { BatchTable, type BatchRow } from "../batch-table";
import { TakeBatchButton } from "../take-batch-button";
import { CloseBatchButton } from "../close-batch-button";

type BatchHead = {
  id: string;
  code: string;
  status: BatchStatus;
  created_at: string;
  pharmacies: { name: string } | null;
};

type ItemRow = {
  id: string;
  status: Status;
  quantity: number;
  created_at: string;
  items: { name_ar: string; category: string | null; unit: string | null } | null;
  profiles: { full_name: string } | null;
  shortage_request_requesters: { count: number }[];
};

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const role = profile?.role;
  const canHandle = role === "sales_rep" || role === "company_admin" || role === "super_admin";

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batches")
    .select("id, code, status, created_at, pharmacies(name)")
    .eq("id", id)
    .maybeSingle();
  if (!batch) notFound();
  const head = batch as unknown as BatchHead;

  const { data: itemsData } = await supabase
    .from("shortage_requests")
    .select(
      "id, status, quantity, created_at, items(name_ar, category, unit), profiles!shortage_requests_requested_by_fkey(full_name), shortage_request_requesters(count)",
    )
    .eq("batch_id", id)
    .order("created_at", { ascending: true });

  const rows: BatchRow[] = ((itemsData ?? []) as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    name: r.items?.name_ar ?? "—",
    category: r.items?.category ?? null,
    unit: r.items?.unit ?? null,
    quantity: r.quantity,
    status: r.status,
    createdAt: r.created_at,
    requestedBy: r.profiles?.full_name ?? null,
    requesters: r.shortage_request_requesters?.[0]?.count ?? 1,
  }));
  const contributors = [...new Set(rows.map((r) => r.requestedBy).filter((n): n is string => !!n))];

  return (
    <div className="space-y-4">
      <Link href="/batches" className="text-sm text-muted-foreground hover:underline">
        ← كل الدفعات
      </Link>

      <div className="glass-panel flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="space-y-1">
          <h1 className="text-lg font-bold">دفعة {head.code}</h1>
          <div className="text-sm text-muted-foreground">
            {head.pharmacies?.name} ·{" "}
            {new Date(head.created_at).toLocaleString("ar-EG-u-nu-latn", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
          {contributors.length > 0 && (
            <div className="text-sm text-muted-foreground">الصيادلة: {contributors.join("، ")}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-xs ${batchStatusBadgeClass[head.status]}`}>
            {batchStatusLabel[head.status]}
          </span>
          {canHandle && head.status === "open" && <TakeBatchButton batchId={id} />}
          {canHandle && head.status === "in_market" && <CloseBatchButton batchId={id} />}
        </div>
      </div>

      <BatchTable batchId={id} status={head.status} canHandle={canHandle} rows={rows} />
    </div>
  );
}
