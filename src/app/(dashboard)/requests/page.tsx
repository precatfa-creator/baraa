import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { statusLabel, statusBadgeClass, priorityLabel, type Status } from "@/lib/workflow";
import { CreateRequestDialog } from "./create-request-dialog";
import { TransitionButtons } from "./transition-buttons";

const STATUSES: Status[] = ["missing", "in_purchase", "fulfilled", "cancelled"];

type RequestRow = {
  id: string;
  status: Status;
  quantity: number;
  priority: string;
  notes: string | null;
  created_at: string;
  items: { name_ar: string } | null;
  pharmacies: { name: string } | null;
  shortage_request_requesters: { count: number }[];
};

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = STATUSES.includes(status as Status) ? (status as Status) : undefined;

  const profile = await getCurrentProfile();
  const role = profile?.role;
  const canCreate = Boolean(profile?.pharmacy_id); // pharmacists create for their branch

  const supabase = await createClient();
  let query = supabase
    .from("shortage_requests")
    .select(
      "id, status, quantity, priority, notes, created_at, items(name_ar), pharmacies(name), shortage_request_requesters(count)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (active) query = query.eq("status", active);
  const { data } = await query;
  const requests = (data ?? []) as unknown as RequestRow[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">النواقص</h1>
        {canCreate && <CreateRequestDialog />}
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Tab href="/requests" label="الكل" current={!active} />
        {STATUSES.map((s) => (
          <Tab
            key={s}
            href={`/requests?status=${s}`}
            label={statusLabel[s]}
            current={active === s}
          />
        ))}
      </nav>

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="glass-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link href={`/requests/${r.id}`} className="font-medium hover:underline">
                    {r.items?.name_ar ?? "—"}
                  </Link>
                  {(r.shortage_request_requesters?.[0]?.count ?? 1) > 1 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      طلبه {r.shortage_request_requesters[0].count}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {r.pharmacies?.name} · الكمية: {r.quantity} · الأولوية:{" "}
                  {priorityLabel[r.priority] ?? r.priority}
                </div>
                {r.notes && <div className="text-sm text-muted-foreground">{r.notes}</div>}
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass[r.status]}`}
              >
                {statusLabel[r.status]}
              </span>
            </div>
            {role && (
              <div className="mt-3">
                <TransitionButtons requestId={r.id} status={r.status} role={role} />
              </div>
            )}
          </div>
        ))}
        {requests.length === 0 && (
          <p className="glass-panel p-6 text-center text-muted-foreground">
            لا توجد نواقص.
          </p>
        )}
      </div>
    </div>
  );
}

function Tab({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-3 py-1 ${
        current ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
      }`}
    >
      {label}
    </Link>
  );
}
