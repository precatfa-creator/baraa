import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import { batchStatusLabel, batchStatusBadgeClass, type BatchStatus, type Status } from "@/lib/workflow";
import { BatchTable, type BatchRow } from "../batch-table";
import { TakeBatchButton } from "../take-batch-button";
import { CloseBatchButton } from "../close-batch-button";
import { BatchAttachments, type BatchAttachment } from "../batch-attachments";

type BatchHead = {
  id: string;
  code: string;
  status: BatchStatus;
  created_at: string;
  default_purchase_source: string | null;
  pharmacies: { name: string } | null;
};

type ItemRow = {
  id: string;
  status: Status;
  quantity: number;
  purchase_source: string | null;
  created_at: string;
  items: { name_ar: string; category: string | null; unit: string | null } | null;
  shortage_request_requesters: {
    profiles: { full_name: string } | null;
  }[];
};

type AttachmentRow = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export default async function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const role = profile?.role;
  const canHandle = role === "sales_rep" || role === "company_admin" || role === "super_admin";

  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batches")
    .select("id, code, status, created_at, default_purchase_source, pharmacies(name)")
    .eq("id", id)
    .maybeSingle();
  if (!batch) notFound();
  const head = batch as unknown as BatchHead;

  const [{ data: itemsData }, { data: attachmentData }] = await Promise.all([
    supabase
      .from("shortage_requests")
      .select(
        "id, status, quantity, purchase_source, created_at, items(name_ar, category, unit), shortage_request_requesters(profiles!shortage_request_requesters_profile_id_fkey(full_name))",
      )
      .eq("batch_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("batch_attachments")
      .select("id, storage_path, file_name, mime_type, size_bytes")
      .eq("batch_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const rows: BatchRow[] = ((itemsData ?? []) as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    name: r.items?.name_ar ?? "—",
    category: r.items?.category ?? null,
    unit: r.items?.unit ?? null,
    quantity: r.quantity,
    status: r.status,
    createdAt: r.created_at,
    requesters: r.shortage_request_requesters
      .map((requester) => requester.profiles?.full_name ?? "")
      .filter(Boolean),
    purchaseSource: r.purchase_source,
  }));
  const contributors = [...new Set(rows.flatMap((row) => row.requesters))];

  const attachmentRows = (attachmentData ?? []) as AttachmentRow[];
  const admin = createAdminClient();
  const attachments: BatchAttachment[] = await Promise.all(
    attachmentRows.map(async (attachment) => {
      const { data } = await admin.storage
        .from("batch-attachments")
        .createSignedUrl(attachment.storage_path, 60 * 60);
      return {
        id: attachment.id,
        fileName: attachment.file_name,
        mimeType: attachment.mime_type,
        size: attachment.size_bytes,
        url: data?.signedUrl ?? "#",
      };
    }),
  );

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
          {head.default_purchase_source && (
            <div className="text-sm">
              جهة الشراء الافتراضية:{" "}
              <span className="font-medium">{head.default_purchase_source}</span>
            </div>
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

      <BatchAttachments batchId={id} attachments={attachments} canManage={canHandle} />
      <BatchTable batchId={id} status={head.status} canHandle={canHandle} rows={rows} />
    </div>
  );
}
