"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ResetResult } from "@/actions/admin-reset";

export type Row = { id: string; label: string };

// Trigger button opens a table of every row of one type, all checked. Uncheck what
// to keep; the checked ids are deleted. Reset to all-checked each time it opens.
export function BulkDeleteDialog({
  label,
  rows,
  successMsg,
  action,
}: {
  label: string;
  rows: Row[];
  successMsg: string;
  action: (ids: string[]) => Promise<ResetResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setChecked(new Set(rows.map((r) => r.id))); // default: all checked
  }

  const allChecked = rows.length > 0 && checked.size === rows.length;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  }

  async function confirm() {
    setPending(true);
    const r = await action([...checked]);
    setPending(false);
    if (!r.ok) {
      toast.error(r.error);
    } else {
      toast.success(`${successMsg} (${r.count})`);
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button variant="destructive" className="w-full justify-start sm:w-auto" />}
      >
        <Trash2 className="size-4" />
        {label}
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>ألغِ تحديد ما تريد الاحتفاظ به؛ المحدد سيُحذف نهائيًا.</DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">لا توجد بيانات.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/80 backdrop-blur">
                <tr>
                  <th className="w-10 p-2 text-center">
                    <input
                      type="checkbox"
                      className="size-4 accent-destructive"
                      checked={allChecked}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="p-2 text-start font-medium text-muted-foreground">
                    محدد {checked.size} من {rows.length}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        className="size-4 accent-destructive"
                        checked={checked.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
                    <td className="p-2">{r.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />} disabled={pending}>
            إلغاء
          </DialogClose>
          <Button variant="destructive" disabled={pending || checked.size === 0} onClick={confirm}>
            حذف المحدد ({checked.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
