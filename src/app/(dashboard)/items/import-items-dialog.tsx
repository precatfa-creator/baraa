"use client";

import { useActionState, useState } from "react";
import { Upload, Download } from "lucide-react";
import { importItems, type ImportResult } from "@/actions/items";
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

type State = ImportResult | { error: string } | null;

// BOM so Excel opens the Arabic CSV as UTF-8.
const TEMPLATE =
  "﻿" +
  "الاسم بالعربية,الاسم بالإنجليزية,الباركود,التصنيف,الوحدة\n" +
  "باراسيتامول 500,Paracetamol 500,6221000000099,مسكنات,علبة\n";

export function ImportItemsDialog() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<State, FormData>(
    async (_prev, formData) => importItems(formData),
    null,
  );

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "items-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" />}>
        <Upload className="size-4" />
        استيراد Excel
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>استيراد أصناف من ملف</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            ارفع ملف Excel أو CSV بالأعمدة: الاسم بالعربية (مطلوب)، الاسم بالإنجليزية، الباركود،
            التصنيف، الوحدة.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
            <Download className="size-4" />
            تنزيل القالب
          </Button>
          <div className="space-y-1">
            <Label htmlFor="file">الملف</Label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,.xls,.csv"
              required
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
          {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
          {state && "added" in state && (
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <p className="text-green-700">تمت إضافة {state.added} صنف.</p>
              {state.skipped > 0 && (
                <p className="text-muted-foreground">تم تخطّي {state.skipped} (باركود مكرر).</p>
              )}
              {state.errors.length > 0 && (
                <ul className="list-inside list-disc text-destructive">
                  {state.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                  {state.errors.length > 5 && <li>…و{state.errors.length - 5} أخطاء أخرى</li>}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الاستيراد…" : "استيراد"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
