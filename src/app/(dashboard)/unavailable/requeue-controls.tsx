"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { requeueNotFound } from "@/actions/batches";
import { Button } from "@/components/ui/button";

export type UnavailableRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  quantity: number;
  createdAt: string;
  pharmacy: string | null;
  requesters: number;
};

export function RequeueControls({ rows, canHandle }: { rows: UnavailableRow[]; canHandle: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function requeue() {
    if (selected.size === 0) {
      toast.error("اختر أصنافًا أولًا.");
      return;
    }
    start(async () => {
      const res = await requeueNotFound([...selected]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("تمت إعادة الأصناف إلى الدفعة المفتوحة.");
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {canHandle && rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
          >
            {allSelected ? "إلغاء التحديد" : "تحديد الكل"}
          </Button>
          <Button size="sm" disabled={pending || selected.size === 0} onClick={requeue}>
            <RotateCcw className="size-4" />
            إعادة {selected.size} إلى الدفعة المفتوحة
          </Button>
        </div>
      )}

      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              {canHandle && <th className="p-3"></th>}
              <th className="p-3 text-start font-medium">الصنف</th>
              <th className="p-3 text-start font-medium">التصنيف</th>
              <th className="p-3 text-start font-medium">الصيدلية</th>
              <th className="p-3 text-start font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                {canHandle && (
                  <td className="p-3">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                )}
                <td className="p-3">
                  {r.name}
                  {r.requesters > 1 && (
                    <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      طلبه {r.requesters}
                    </span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{r.category ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{r.pharmacy ?? "—"}</td>
                <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("ar-EG-u-nu-latn", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canHandle ? 5 : 4} className="p-6 text-center text-muted-foreground">
                  لا توجد أصناف غير متوفرة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
