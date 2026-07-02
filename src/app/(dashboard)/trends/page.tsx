import Link from "next/link";
import { ClipboardList, Trophy, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type TrendRow = {
  item_id: string;
  name_ar: string;
  category: string | null;
  shortage_count: number;
  total_requesters: number;
  fulfilled_count: number;
  last_at: string;
};

type LeaderboardRow = {
  rep_id: string;
  full_name: string;
  purchased_items: number;
  batches_handled: number;
  average_minutes: number;
  fastest_minutes: number;
  last_purchase_at: string;
};

const WINDOWS = [
  { key: "30", label: "آخر ٣٠ يومًا", days: 30 },
  { key: "90", label: "آخر ٩٠ يومًا", days: 90 },
  { key: "all", label: "كل الوقت", days: null as number | null },
];

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const { window } = await searchParams;
  const current = WINDOWS.find((w) => w.key === window) ?? WINDOWS[1]; // default 90 days

  const supabase = await createClient();
  const [{ data }, { data: leaderboardData }] = await Promise.all([
    supabase.rpc("trending_items", { p_days: current.days, p_limit: 50 }),
    supabase.rpc("rep_purchase_leaderboard", { p_days: current.days, p_limit: 20 }),
  ]);
  const rows = (data ?? []) as TrendRow[];
  const leaderboard = (leaderboardData ?? []) as LeaderboardRow[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <TrendingUp className="size-5 text-primary" />
          الأكثر طلبًا
        </h1>
        <p className="text-sm text-muted-foreground">
          الأصناف الأكثر تسجيلًا كنواقص — مؤشر على الأدوية سريعة النفاد وعالية الطلب.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={`/trends?window=${w.key}`}
            className={`rounded-md border px-3 py-1 ${
              current.key === w.key
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent"
            }`}
          >
            {w.label}
          </Link>
        ))}
      </nav>

      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-medium">#</th>
              <th className="p-3 text-start font-medium">الصنف</th>
              <th className="p-3 text-start font-medium">التصنيف</th>
              <th className="p-3 text-start font-medium">مرات النقص</th>
              <th className="p-3 text-start font-medium">إجمالي الطلبات</th>
              <th className="p-3 text-start font-medium">تم توفيره</th>
              <th className="p-3 text-start font-medium">آخر طلب</th>
              <th className="p-3 text-start font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.item_id} className="border-b last:border-0">
                <td className="p-3 text-muted-foreground">{i + 1}</td>
                <td className="p-3 font-medium">{r.name_ar}</td>
                <td className="p-3 text-muted-foreground">{r.category ?? "—"}</td>
                <td className="p-3">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {r.shortage_count}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{r.total_requesters}</td>
                <td className="p-3 text-muted-foreground">{r.fulfilled_count}</td>
                <td className="p-3 text-muted-foreground">
                  {new Date(r.last_at).toLocaleDateString("ar-EG-u-nu-latn", { dateStyle: "medium" })}
                </td>
                <td className="p-3 text-end">
                  <Link
                    href={`/trends/${r.item_id}?window=${current.key}`}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                  >
                    <ClipboardList className="size-3.5" />
                    السجل
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  لا توجد بيانات في هذه الفترة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Trophy className="size-5 text-amber-500" />
            ترتيب مندوبي المبيعات
          </h2>
          <p className="text-sm text-muted-foreground">
            الترتيب حسب عدد الأصناف المشتراة أولًا، ثم متوسط سرعة الشراء.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {leaderboard.map((rep, index) => (
            <div key={rep.rep_id} className="glass-panel flex items-start gap-3 p-4">
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full font-bold ${
                  index === 0
                    ? "bg-amber-100 text-amber-800"
                    : index === 1
                      ? "bg-zinc-200 text-zinc-700"
                      : index === 2
                        ? "bg-orange-100 text-orange-800"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{rep.full_name}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <Metric label="أصناف مشتراة" value={rep.purchased_items} />
                  <Metric label="دفعات عمل عليها" value={rep.batches_handled} />
                  <Metric label="متوسط السرعة" value={formatMinutes(rep.average_minutes)} />
                  <Metric label="أسرع شراء" value={formatMinutes(rep.fastest_minutes)} />
                </div>
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <p className="glass-panel p-6 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
              لا توجد عمليات شراء مكتملة لمندوبي المبيعات في هذه الفترة.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-muted/60 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold text-foreground">{value}</div>
    </div>
  );
}

function formatMinutes(value: number): string {
  if (value < 60) return `${Math.round(value)} د`;
  return `${(value / 60).toFixed(1)} س`;
}
