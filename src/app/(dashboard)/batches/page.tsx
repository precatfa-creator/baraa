import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { batchStatusLabel, batchStatusBadgeClass, type BatchStatus } from "@/lib/workflow";

const STATUSES: BatchStatus[] = ["open", "in_market", "closed"];

type BatchRow = {
  id: string;
  code: string;
  status: BatchStatus;
  created_at: string;
  pharmacy_id: string;
  pharmacies: { name: string } | null;
};

type AggItem = {
  batch_id: string;
  status: string;
  profiles: { full_name: string } | null;
};

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = STATUSES.includes(status as BatchStatus) ? (status as BatchStatus) : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("batches")
    .select("id, code, status, created_at, pharmacy_id, pharmacies(name)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (active) query = query.eq("status", active);
  const { data } = await query;
  const batches = (data ?? []) as unknown as BatchRow[];

  // per-batch counts + contributor names for the listed batches
  const ids = batches.map((b) => b.id);
  const agg: Record<string, { total: number; done: number; contributors: Set<string> }> = {};
  if (ids.length) {
    const { data: items } = await supabase
      .from("shortage_requests")
      .select("batch_id, status, profiles!shortage_requests_requested_by_fkey(full_name)")
      .in("batch_id", ids);
    for (const it of (items ?? []) as unknown as AggItem[]) {
      const a = (agg[it.batch_id] ??= { total: 0, done: 0, contributors: new Set() });
      a.total++;
      if (it.status === "fulfilled") a.done++;
      if (it.profiles?.full_name) a.contributors.add(it.profiles.full_name);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الدُفعات</h1>

      <nav className="flex flex-wrap gap-2 text-sm">
        <Tab href="/batches" label="الكل" current={!active} />
        {STATUSES.map((s) => (
          <Tab key={s} href={`/batches?status=${s}`} label={batchStatusLabel[s]} current={active === s} />
        ))}
      </nav>

      <div className="space-y-3">
        {batches.map((b) => {
          const a = agg[b.id] ?? { total: 0, done: 0, contributors: new Set<string>() };
          return (
            <Link key={b.id} href={`/batches/${b.id}`} className="glass-panel glass-hover block p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-medium">
                    دفعة {b.code}
                    <span className="text-muted-foreground"> · {b.pharmacies?.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(b.created_at).toLocaleString("ar-EG-u-nu-latn", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {" · "}
                    {a.done}/{a.total} تم شراؤها
                  </div>
                  {a.contributors.size > 0 && (
                    <div className="text-sm text-muted-foreground">
                      الصيادلة: {[...a.contributors].join("، ")}
                    </div>
                  )}
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${batchStatusBadgeClass[b.status]}`}>
                  {batchStatusLabel[b.status]}
                </span>
              </div>
            </Link>
          );
        })}
        {batches.length === 0 && (
          <p className="glass-panel p-6 text-center text-muted-foreground">لا توجد دفعات.</p>
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
