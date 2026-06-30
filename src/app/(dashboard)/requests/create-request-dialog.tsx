"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createShortageRequest, type ActionResult } from "@/actions/requests";
import { ItemCombobox } from "./item-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { priorityLabel } from "@/lib/workflow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export function CreateRequestDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (prev, formData) => {
      const result = await createShortageRequest(prev, formData);
      if (result.ok) setOpen(false);
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        إضافة نقص
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تسجيل نقص</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1">
            <Label>الصنف</Label>
            <ItemCombobox />
          </div>
          <div className="space-y-1">
            <Label htmlFor="priority">الأولوية</Label>
            <select
              id="priority"
              name="priority"
              defaultValue="normal"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              {Object.entries(priorityLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">ملاحظات</Label>
            <Input id="notes" name="notes" />
          </div>
          {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
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
