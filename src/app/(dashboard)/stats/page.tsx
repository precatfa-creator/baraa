import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  PackageCheck,
  PackageSearch,
  Pill,
  Trophy,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { getAdminProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { statusLabel, type Status } from "@/lib/workflow";

type ChartDatum = { label: string; value: number };
type DailyDatum = { date: string; value: number };
type StatsData = {
  kpis: {
    requests: number;
    active: number;
    fulfilled: number;
    unavailable: number;
    batches: number;
    average_purchase_minutes: number | null;
    items: number;
    pharmacies: number;
    active_users: number;
  };
  status_counts: ChartDatum[];
  daily_requests: DailyDatum[];
  top_items: ChartDatum[];
  pharmacy_activity: ChartDatum[];
  purchase_sources: ChartDatum[];
};
type RepRow = {
  rep_id: string;
  full_name: string;
  purchased_items: number;
  batches_handled: number;
  average_minutes: number;
  fastest_minutes: number;
};
type PharmacistRow = {
  pharmacist_id: string;
  full_name: string;
  requests_submitted: number;
  unique_items: number;
  fulfilled_requests: number;
  fulfillment_rate: number;
};

const WINDOWS = [
  { key: "30", label: "آخر ٣٠ يومًا", days: 30 },
  { key: "90", label: "آخر ٩٠ يومًا", days: 90 },
  { key: "all", label: "كل الوقت", days: null as number | null },
];

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  if (!(await getAdminProfile())) redirect("/dashboard");

  const { window } = await searchParams;
  const current = WINDOWS.find((item) => item.key === window) ?? WINDOWS[1];
  const supabase = await createClient();
  const [statsResult, repsResult, pharmacistsResult] = await Promise.all([
    supabase.rpc("admin_operational_stats", { p_days: current.days }),
    supabase.rpc("rep_purchase_leaderboard", { p_days: current.days, p_limit: 20 }),
    supabase.rpc("pharmacist_activity_leaderboard", {
      p_days: current.days,
      p_limit: 20,
    }),
  ]);

  if (statsResult.error) throw new Error(statsResult.error.message);
  if (repsResult.error) throw new Error(repsResult.error.message);
  if (pharmacistsResult.error) throw new Error(pharmacistsResult.error.message);

  const stats = statsResult.data as StatsData;
  const reps = (repsResult.data ?? []) as RepRow[];
  const pharmacists = (pharmacistsResult.data ?? []) as PharmacistRow[];
  const kpis = stats.kpis;

  const cards = [
    { label: "إجمالي الطلبات", value: kpis.requests, icon: ClipboardList },
    { label: "طلبات نشطة", value: kpis.active, icon: Activity },
    { label: "تم توفيرها", value: kpis.fulfilled, icon: PackageCheck },
    { label: "غير متوفرة", value: kpis.unavailable, icon: PackageSearch },
    { label: "الدُفعات", value: kpis.batches, icon: PackageSearch },
    {
      label: "متوسط سرعة الشراء",
      value: formatMinutes(kpis.average_purchase_minutes),
      icon: Clock3,
    },
    { label: "الأصناف النشطة", value: kpis.items, icon: Pill },
    { label: "الصيدليات", value: kpis.pharmacies, icon: Building2 },
    { label: "المستخدمون النشطون", value: kpis.active_users, icon: Users },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <ChartNoAxesCombined className="size-5 text-primary" />
          Stats · الإحصائيات
        </h1>
        <p className="text-sm text-muted-foreground">
          نظرة إدارية شاملة على الطلبات، الشراء، الصيدليات وأداء الفريق.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {WINDOWS.map((item) => (
          <Link
            key={item.key}
            href={`/stats?window=${item.key}`}
            className={`rounded-md border px-3 py-1 ${
              current.key === item.key
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-panel flex items-center gap-3 p-4">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel p-4 lg:col-span-2">
          <SectionTitle title="نشاط الطلبات اليومي" subtitle="آخر ٩٠ يومًا كحد أقصى" />
          <DailyChart data={stats.daily_requests} />
        </div>
        <div className="glass-panel p-4">
          <SectionTitle title="حالات الطلبات" />
          <HorizontalBars
            data={stats.status_counts.map((item) => ({
              ...item,
              label: statusLabel[item.label as Status] ?? item.label,
            }))}
          />
        </div>
        <div className="glass-panel p-4">
          <SectionTitle title="الأصناف الأكثر طلبًا" />
          <HorizontalBars data={stats.top_items} />
        </div>
        <div className="glass-panel p-4">
          <SectionTitle title="نشاط الصيدليات" subtitle="بحسب عدد طلبات النواقص" />
          <HorizontalBars data={stats.pharmacy_activity} />
        </div>
        <div className="glass-panel p-4">
          <SectionTitle title="جهات الشراء" subtitle="بحسب عمليات الشراء المسجلة" />
          <HorizontalBars data={stats.purchase_sources} />
        </div>
      </section>

      <Leaderboard
        title="ترتيب مندوبي المبيعات"
        subtitle="حسب الأصناف المشتراة أولًا، ثم متوسط سرعة الشراء."
        empty="لا توجد عمليات شراء مكتملة في هذه الفترة."
        rows={reps.map((rep) => ({
          id: rep.rep_id,
          name: rep.full_name,
          metrics: [
            ["أصناف مشتراة", rep.purchased_items],
            ["دُفعات", rep.batches_handled],
            ["متوسط السرعة", formatMinutes(rep.average_minutes)],
            ["أسرع شراء", formatMinutes(rep.fastest_minutes)],
          ],
        }))}
      />

      <Leaderboard
        title="ترتيب الصيادلة"
        subtitle="حسب عدد الطلبات المسجلة أولًا، ثم عدد الطلبات التي تم توفيرها."
        empty="لا توجد طلبات مسجلة للصيادلة في هذه الفترة."
        rows={pharmacists.map((pharmacist) => ({
          id: pharmacist.pharmacist_id,
          name: pharmacist.full_name,
          metrics: [
            ["الطلبات", pharmacist.requests_submitted],
            ["أصناف مختلفة", pharmacist.unique_items],
            ["تم توفيرها", pharmacist.fulfilled_requests],
            ["نسبة التوفير", `${pharmacist.fulfillment_rate}%`],
          ],
        }))}
      />
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function HorizontalBars({ data }: { data: ChartDatum[] }) {
  const max = Math.max(...data.map((item) => Number(item.value)), 1);
  if (data.length === 0) return <EmptyChart />;
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-xs">
            <span className="truncate">{item.label}</span>
            <span className="font-semibold">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max((Number(item.value) / max) * 100, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DailyChart({ data }: { data: DailyDatum[] }) {
  const max = Math.max(...data.map((item) => Number(item.value)), 1);
  if (data.length === 0) return <EmptyChart />;
  return (
    <div className="overflow-x-auto">
      <div className="flex h-44 min-w-max items-end gap-1 border-b px-1">
        {data.map((item, index) => (
          <div
            key={item.date}
            className="group relative flex h-full w-3 items-end sm:w-4"
            title={`${new Date(item.date).toLocaleDateString("ar-EG-u-nu-latn")}: ${item.value}`}
          >
            <div
              className="w-full rounded-t bg-primary/75 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max((Number(item.value) / max) * 100, 4)}%` }}
            />
            {(index === 0 || index === data.length - 1) && (
              <span className="absolute -bottom-5 start-0 whitespace-nowrap text-[10px] text-muted-foreground">
                {new Date(item.date).toLocaleDateString("ar-EG-u-nu-latn", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="h-5" />
    </div>
  );
}

function EmptyChart() {
  return <p className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات.</p>;
}

function Leaderboard({
  title,
  subtitle,
  rows,
  empty,
}: {
  title: string;
  subtitle: string;
  rows: { id: string; name: string; metrics: [string, string | number][] }[];
  empty: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Trophy className="size-5 text-amber-500" />
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row, index) => (
          <div key={row.id} className="glass-panel flex items-start gap-3 p-4">
            <Rank value={index + 1} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <UserRoundCheck className="size-4 text-primary" />
                <span className="truncate">{row.name}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                {row.metrics.map(([label, value]) => (
                  <div key={label} className="rounded-md bg-muted/60 p-2">
                    <div className="text-muted-foreground">{label}</div>
                    <div className="mt-0.5 font-semibold">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="glass-panel p-6 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}

function Rank({ value }: { value: number }) {
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full font-bold ${
        value === 1
          ? "bg-amber-100 text-amber-800"
          : value === 2
            ? "bg-zinc-200 text-zinc-700"
            : value === 3
              ? "bg-orange-100 text-orange-800"
              : "bg-muted text-muted-foreground"
      }`}
    >
      {value}
    </span>
  );
}

function formatMinutes(value: number | null): string {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  if (Number(value) < 60) return `${Math.round(Number(value))} د`;
  return `${(Number(value) / 60).toFixed(1)} س`;
}
