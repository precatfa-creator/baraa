"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Scissors, Check, Pencil } from "lucide-react";
import { setItemPurchased, setItemPurchaseSource, splitBatch } from "@/actions/batches";
import { statusLabel, statusBadgeClass, type Status, type BatchStatus } from "@/lib/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequesterChips } from "@/components/requester-chips";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type BatchRow = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  quantity: number;
  status: Status;
  createdAt: string;
  requesters: string[];
  purchaseSource: string | null;
};

export function BatchTable({
  batchId,
  status,
  canHandle,
  rows,
}: {
  batchId: string;
  status: BatchStatus;
  canHandle: boolean;
  rows: BatchRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [splitMode, setSplitMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const canMark = canHandle && status === "in_market";
  const canSplit = canHandle && status === "in_market";
  const categories = [...new Set(rows.map((r) => r.category).filter((c): c is string => !!c))];

  function toggleSel(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectCategory(cat: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      rows.filter((r) => r.category === cat).forEach((r) => n.add(r.id));
      return n;
    });
  }

  function mark(id: string, purchased: boolean) {
    start(async () => {
      const res = await setItemPurchased(id, purchased);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  function doSplit() {
    if (selected.size === 0) {
      toast.error("اختر أصنافًا أولًا.");
      return;
    }
    start(async () => {
      const res = await splitBatch(batchId, [...selected]);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("تم إنشاء دفعة جديدة.");
      router.push(`/batches/${res.newBatchId}`);
    });
  }

  return (
    <div className="space-y-3">
      {canSplit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={splitMode ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              setSplitMode(!splitMode);
              setSelected(new Set());
            }}
          >
            <Scissors className="size-4" />
            {splitMode ? "إلغاء التقسيم" : "تقسيم الدفعة"}
          </Button>
          {splitMode &&
            categories.map((c) => (
              <Button key={c} variant="ghost" size="sm" onClick={() => selectCategory(c)}>
                تحديد: {c}
              </Button>
            ))}
          {splitMode && (
            <Button size="sm" disabled={pending || selected.size === 0} onClick={doSplit}>
              نقل {selected.size} إلى دفعة جديدة
            </Button>
          )}
        </div>
      )}

      <div className="glass-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              {splitMode && <th className="p-3"></th>}
              <th className="p-3 text-start font-medium">الصنف</th>
              <th className="p-3 text-start font-medium">التصنيف</th>
              <th className="p-3 text-start font-medium">الصيادلة</th>
              <th className="p-3 text-start font-medium">جهة الشراء</th>
              <th className="p-3 text-start font-medium">التاريخ</th>
              <th className="p-3 text-start font-medium">
                {canMark && !splitMode ? "تم الشراء" : "الحالة"}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                {splitMode && (
                  <td className="p-3">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSel(r.id)}
                    />
                  </td>
                )}
                <td className="p-3">
                  {r.name}
                </td>
                <td className="p-3 text-muted-foreground">{r.category ?? "—"}</td>
                <td className="p-3">
                  <RequesterChips names={r.requesters} />
                </td>
                <td className="p-3">
                  <PurchaseSourceEditor
                    requestId={r.id}
                    source={r.purchaseSource}
                    editable={canHandle && status !== "open"}
                  />
                </td>
                <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString("ar-EG-u-nu-latn", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="p-3">
                  {canMark && !splitMode && (r.status === "in_purchase" || r.status === "fulfilled") ? (
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4"
                        disabled={pending}
                        checked={r.status === "fulfilled"}
                        onChange={(e) => mark(r.id, e.target.checked)}
                      />
                      {r.status === "fulfilled" && <Check className="size-4 text-green-600" />}
                    </label>
                  ) : (
                    <span className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass[r.status]}`}>
                      {statusLabel[r.status]}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={splitMode ? 7 : 6} className="p-6 text-center text-muted-foreground">
                  لا أصناف في هذه الدفعة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseSourceEditor({
  requestId,
  source,
  editable,
}: {
  requestId: string;
  source: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(source ?? "");
  const [pending, start] = useTransition();

  if (!editable) return <span className="text-muted-foreground">{source ?? "—"}</span>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="h-auto max-w-48 justify-start px-2 py-1" />
        }
      >
        <span className="truncate">{source ?? "تحديد الجهة"}</span>
        <Pencil className="size-3" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>تعديل جهة شراء الصنف</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`purchase-source-${requestId}`}>الشركة أو المكان</Label>
          <Input
            id={`purchase-source-${requestId}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={200}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !value.trim()}
            onClick={() =>
              start(async () => {
                const result = await setItemPurchaseSource(requestId, value);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("تم تحديث جهة الشراء.");
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "جارٍ الحفظ…" : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
