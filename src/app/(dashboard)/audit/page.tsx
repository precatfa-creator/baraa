import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Filter, ScrollText, Search } from "lucide-react";
import { getAdminProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  auditEventLabel,
  auditEventLabels,
  entityLabel,
} from "@/lib/audit-labels";

type AuditRow = {
  id: number;
  created_at: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  total_count: number;
};

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!(await getAdminProfile())) redirect("/dashboard");
  const params = await searchParams;
  const page = Math.max(Number.parseInt(params.page ?? "1", 10) || 1, 1);
  const search = params.q?.trim() || null;
  const eventType = params.type && params.type !== "all" ? params.type : null;
  const actorId = params.actor && params.actor !== "all" ? params.actor : null;
  const from = validDate(params.from) ? `${params.from}T00:00:00.000Z` : null;
  const to = validDate(params.to) ? `${params.to}T23:59:59.999Z` : null;

  const supabase = await createClient();
  const [reportResult, actorsResult] = await Promise.all([
    supabase.rpc("admin_audit_report", {
      p_search: search,
      p_event_type: eventType,
      p_actor_id: actorId,
      p_from: from,
      p_to: to,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name"),
  ]);
  if (reportResult.error) throw new Error(reportResult.error.message);

  const rows = (reportResult.data ?? []) as AuditRow[];
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const query = new URLSearchParams();
  for (const key of ["q", "type", "actor", "from", "to"]) {
    if (params[key]) query.set(key, params[key]!);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ScrollText className="size-5 text-primary" />
            سجل النظام الشامل
          </h1>
          <p className="text-sm text-muted-foreground">
            تقرير زمني غير قابل للتعديل لكل العمليات والتغييرات المسجلة في النظام.
          </p>
        </div>
        <a
          href={`/audit/export?${query.toString()}`}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <Download className="size-4" />
          تصدير Excel
        </a>
      </div>

      <form className="glass-panel grid gap-3 p-4 md:grid-cols-2 lg:grid-cols-6">
        <label className="relative lg:col-span-2">
          <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="بحث في المستخدم أو السجل أو التفاصيل"
            className="w-full rounded-md border bg-transparent py-2 ps-9 pe-3 text-sm"
          />
        </label>
        <select
          name="type"
          defaultValue={params.type ?? "all"}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="all">كل العمليات</option>
          {Object.entries(auditEventLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          name="actor"
          defaultValue={params.actor ?? "all"}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="all">كل المستخدمين</option>
          {(actorsResult.data ?? []).map((actor) => (
            <option key={actor.id} value={actor.id}>{actor.full_name}</option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={params.from}
          aria-label="من تاريخ"
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={params.to}
          aria-label="إلى تاريخ"
          className="rounded-md border bg-transparent px-3 py-2 text-sm"
        />
        <div className="flex gap-2 lg:col-span-6">
          <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
            <Filter className="size-4" />
            تطبيق الفلاتر
          </button>
          <Link href="/audit" className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
            مسح
          </Link>
        </div>
      </form>

      <div className="text-sm text-muted-foreground">
        {total.toLocaleString("ar-EG-u-nu-latn")} حدث مسجل
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="glass-panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    {auditEventLabel(row.event_type)}
                  </span>
                  <span className="text-sm font-semibold">{entityLabel(row.entity_type)}</span>
                  {row.entity_id && (
                    <code className="max-w-48 truncate text-xs text-muted-foreground" dir="ltr">
                      {row.entity_id}
                    </code>
                  )}
                </div>
                <div className="mt-2 text-sm">
                  المنفذ: <span className="font-medium">{row.actor_name ?? "النظام"}</span>
                  {row.actor_role && <span className="text-muted-foreground"> · {roleLabel(row.actor_role)}</span>}
                </div>
              </div>
              <time className="text-xs text-muted-foreground" dir="ltr">
                {new Date(row.created_at).toLocaleString("ar-LY-u-nu-latn", {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}
              </time>
            </div>
            <details className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
              <summary className="cursor-pointer font-medium">عرض كل التفاصيل</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {row.ip_address && <Detail label="IP" value={row.ip_address} />}
                {row.user_agent && <Detail label="الجهاز والمتصفح" value={row.user_agent} />}
              </div>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-background/70 p-3 text-start" dir="ltr">
                {JSON.stringify(row.details, null, 2)}
              </pre>
            </details>
          </article>
        ))}
        {rows.length === 0 && (
          <p className="glass-panel p-8 text-center text-muted-foreground">
            لا توجد أحداث تطابق الفلاتر.
          </p>
        )}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <PageLink page={page - 1} query={query} label="السابق" />}
          <span>صفحة {page} من {pages}</span>
          {page < pages && <PageLink page={page + 1} query={query} label="التالي" />}
        </nav>
      )}
    </div>
  );
}

function PageLink({ page, query, label }: { page: number; query: URLSearchParams; label: string }) {
  const next = new URLSearchParams(query);
  next.set("page", String(page));
  return <Link href={`/audit?${next}`} className="rounded-md border px-3 py-1.5 hover:bg-accent">{label}</Link>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><span className="text-muted-foreground">{label}: </span><span dir="ltr">{value}</span></div>;
}

function validDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function roleLabel(role: string): string {
  return {
    super_admin: "مدير المنصة",
    company_admin: "مدير الشركة",
    pharmacist: "صيدلي",
    sales_rep: "مندوب",
  }[role] ?? role;
}
