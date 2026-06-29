"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment, deactivateAssignment } from "@/actions/assignments";
import type { AdminFormState } from "@/actions/pharmacies";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const selectClass = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm";

type Option = { id: string; name: string };

export function AssignmentDialog({ reps, pharmacies }: { reps: Option[]; pharmacies: Option[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(
    async (prev, formData) => {
      const result = await createAssignment(prev, formData);
      if (result === null) setOpen(false);
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>إضافة تعيين</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعيين مندوب لصيدلية</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sales_rep_id">المندوب</Label>
            <select id="sales_rep_id" name="sales_rep_id" className={selectClass} required>
              <option value="">— اختر —</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pharmacy_id">الصيدلية</Label>
            <select id="pharmacy_id" name="pharmacy_id" className={selectClass} required>
              <option value="">— اختر —</option>
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveAssignment({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await deactivateAssignment(id);
          router.refresh();
        })
      }
    >
      إزالة
    </Button>
  );
}
