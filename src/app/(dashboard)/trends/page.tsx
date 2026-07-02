import Link from "next/link";
import { TrendingUp } from "lucide-react";
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
  const { data } = await supabase.rpc("trending_items", { p_days: current.days, p_limit: 50 });
  const rows = (data ?? []) as TrendRow[];

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
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  لا توجد بيانات في هذه الفترة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
