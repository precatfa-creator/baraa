"use client";

import { useActionState, useState } from "react";
import { createItem, updateItem, type ItemFormState } from "@/actions/items";
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

export type ItemFields = {
  id: string;
  name_ar: string;
  name_en: string | null;
  barcode: string | null;
  category: string | null;
  unit: string | null;
};

// One dialog for both create (no `item`) and edit (existing `item`).
export function ItemDialog({
  item,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
  categories = [],
  units = [],
}: {
  item?: ItemFields;
  triggerLabel: string;
  triggerVariant?: "default" | "ghost" | "secondary" | "outline";
  triggerSize?: "default" | "sm";
  categories?: string[];
  units?: string[];
}) {
  const action = item ? updateItem : createItem;
  const [open, setOpen] = useState(false);
  // Close on success (action returns null); keep the dialog open with the error otherwise.
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(
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
          <DialogTitle>{item ? "تعديل الصنف" : "إضافة صنف"}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {item && <input type="hidden" name="id" value={item.id} />}
          <Field name="name_ar" label="الاسم بالعربية" defaultValue={item?.name_ar} required />
          <Field name="name_en" label="الاسم بالإنجليزية" defaultValue={item?.name_en} />
          <Field name="barcode" label="الباركود" defaultValue={item?.barcode} />
          <DatalistField name="category" label="التصنيف" defaultValue={item?.category} options={categories} />
          <DatalistField name="unit" label="الوحدة" defaultValue={item?.unit} options={units} />
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

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} required={required} />
    </div>
  );
}

// Pick from the per-tenant list (native datalist) or type a new value — the new
// one is auto-registered on save by the server action.
function DatalistField({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  options: string[];
}) {
  const listId = `${name}-list`;
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        list={listId}
        defaultValue={defaultValue ?? ""}
        autoComplete="off"
        placeholder="اختر من القائمة أو اكتب قيمة جديدة"
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
