import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ItemDialog, type ItemFields } from "./item-dialog";

const PAGE_SIZE = 20;

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const from = (pageNum - 1) * PAGE_SIZE;

  const profile = await getCurrentProfile();
  const canManage = profile?.role === "company_admin" || profile?.role === "super_admin";

  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("id, name_ar, name_en, barcode, category, unit", { count: "exact" })
    .order("name_ar", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  // Strip chars that are syntax in PostgREST's or() filter before interpolating.
  const term = q.replace(/[,()*]/g, "").trim();
  if (term) {
    query = query.or(`name_ar.ilike.%${term}%,barcode.ilike.%${term}%`);
  }

  const { data: items, count } = await query;
  const total = count ?? 0;
  const hasPrev = pageNum > 1;
  const hasNext = from + PAGE_SIZE < total;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">الأصناف</h1>
        {canManage && <ItemDialog triggerLabel="إضافة صنف" />}
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="ابحث بالاسم أو الباركود"
          className="w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
        <Button type="submit" variant="secondary">
          بحث
        </Button>
      </form>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-medium">الاسم</th>
              <th className="p-3 text-start font-medium">الباركود</th>
              <th className="p-3 text-start font-medium">التصنيف</th>
              <th className="p-3 text-start font-medium">الوحدة</th>
              {canManage && <th className="p-3 text-start font-medium"></th>}
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="p-3">{item.name_ar}</td>
                <td className="p-3 text-muted-foreground">{item.barcode ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{item.category ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{item.unit ?? "—"}</td>
                {canManage && (
                  <td className="p-3 text-end">
                    <ItemDialog
                      item={item as ItemFields}
                      triggerLabel="تعديل"
                      triggerVariant="ghost"
                      triggerSize="sm"
                    />
                  </td>
                )}
              </tr>
            ))}
            {(items ?? []).length === 0 && (
              <tr>
                <td colSpan={canManage ? 5 : 4} className="p-6 text-center text-muted-foreground">
                  لا توجد أصناف.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{total} صنف</span>
        <div className="flex gap-2">
          <PageLink q={q} page={pageNum - 1} disabled={!hasPrev}>
            السابق
          </PageLink>
          <PageLink q={q} page={pageNum + 1} disabled={!hasNext}>
            التالي
          </PageLink>
        </div>
      </div>
    </div>
  );
}

function PageLink({
  q,
  page,
  disabled,
  children,
}: {
  q: string;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border px-3 py-1 text-muted-foreground opacity-50">{children}</span>
    );
  }
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("page", String(page));
  return (
    <a href={`/items?${params}`} className="rounded-md border px-3 py-1 hover:bg-accent">
      {children}
    </a>
  );
}
