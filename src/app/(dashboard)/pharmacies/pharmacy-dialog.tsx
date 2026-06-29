"use client";

import { useActionState, useState } from "react";
import { createPharmacy, updatePharmacy, type AdminFormState } from "@/actions/pharmacies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export type PharmacyFields = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

export function PharmacyDialog({
  pharmacy,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
}: {
  pharmacy?: PharmacyFields;
  triggerLabel: string;
  triggerVariant?: "default" | "ghost";
  triggerSize?: "default" | "sm";
}) {
  const action = pharmacy ? updatePharmacy : createPharmacy;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      if (result === null) setOpen(false);
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pharmacy ? "تعديل صيدلية" : "إضافة صيدلية"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {pharmacy && <input type="hidden" name="id" value={pharmacy.id} />}
          <div className="space-y-1">
            <Label htmlFor="name">الاسم</Label>
            <Input id="name" name="name" defaultValue={pharmacy?.name} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="address">العنوان</Label>
            <Input id="address" name="address" defaultValue={pharmacy?.address ?? ""} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">الهاتف</Label>
            <Input id="phone" name="phone" defaultValue={pharmacy?.phone ?? ""} />
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
