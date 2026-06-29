import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { statusLabel, statusBadgeClass, priorityLabel, type Status } from "@/lib/workflow";
import { TransitionButtons } from "../transition-buttons";

type HistoryRow = {
  id: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
};

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  // RLS scopes this to requests the viewer may see; anything else returns no row.
  const { data: request } = await supabase
    .from("shortage_requests")
    .select("id, status, quantity, priority, notes, created_at, items(name_ar), pharmacies(name)")
    .eq("id", id)
    .maybeSingle();
  if (!request) notFound();

  const { data: history } = await supabase
    .from("shortage_status_history")
    .select("id, old_status, new_status, note, created_at, profiles:changed_by(full_name)")
    .eq("shortage_request_id", id)
    .order("created_at", { ascending: true });

  const item = request.items as unknown as { name_ar: string } | null;
  const pharmacy = request.pharmacies as unknown as { name: string } | null;
  const status = request.status as Status;
  const events = (history ?? []) as unknown as HistoryRow[];

  return (
    <div className="space-y-6">
      <Link href="/requests" className="text-sm text-muted-foreground hover:underline">
        ← الرجوع إلى النواقص
      </Link>

      <div className="rounded-md border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-lg font-bold">{item?.name_ar ?? "—"}</h1>
            <div className="text-sm text-muted-foreground">
              {pharmacy?.name} · الكمية: {request.quantity} · الأولوية:{" "}
              {priorityLabel[request.priority] ?? request.priority}
            </div>
            {request.notes && <div className="text-sm text-muted-foreground">{request.notes}</div>}
          </div>
          <span className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass[status]}`}>
            {statusLabel[status]}
          </span>
        </div>
        {profile?.role && (
          <div className="mt-4">
            <TransitionButtons requestId={request.id} status={status} role={profile.role} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">سجل الحالة</h2>
        <ol className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>
                  {e.old_status ? `${statusLabel[e.old_status as Status]} ← ` : ""}
                  <span className="font-medium">{statusLabel[e.new_status as Status]}</span>
                </span>
                <span className="text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("ar")}
                </span>
              </div>
              <div className="text-muted-foreground">
                {e.profiles?.full_name}
                {e.note ? ` · ${e.note}` : ""}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
