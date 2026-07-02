"use client";

import { useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { importItems, type ImportResult } from "@/actions/items";
import {
  MAX_IMPORT_ROWS,
  mapSheetRow,
  type ImportItemRow,
} from "@/lib/item-import";
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

type PreviewRow = ImportItemRow & { key: number };
type Result = ImportResult | { error: string } | null;
type EditableField = keyof ImportItemRow;

// BOM so Excel opens the Arabic CSV as UTF-8.
const TEMPLATE =
  "﻿" +
  "الاسم بالعربية,الاسم بالإنجليزية,الباركود,التصنيف,الوحدة\n" +
  "باراسيتامول 500,Paracetamol 500,6221000000099,مسكنات,علبة\n";

const columns: Array<{ field: EditableField; label: string; required?: boolean }> = [
  { field: "name_ar", label: "الاسم بالعربية", required: true },
  { field: "name_en", label: "الاسم بالإنجليزية" },
  { field: "barcode", label: "الباركود" },
  { field: "category", label: "التصنيف" },
  { field: "unit", label: "الوحدة" },
];

export function ImportItemsDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [pending, startTransition] = useTransition();

  const duplicateKeys = useMemo(() => {
    const byBarcode = new Map<string, number[]>();
    rows.forEach((row) => {
      const barcode = row.barcode.trim();
      if (!barcode) return;
      byBarcode.set(barcode, [...(byBarcode.get(barcode) ?? []), row.key]);
    });
    return new Set(
      [...byBarcode.values()].filter((keys) => keys.length > 1).flat(),
    );
  }, [rows]);

  const invalidRows = rows.filter((row) => !row.name_ar.trim()).length;

  function resetDialog() {
    setRows([]);
    setFileName("");
    setError(null);
    setResult(null);
    setFileInputKey((key) => key + 1);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) resetDialog();
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    setResult(null);
    setRows([]);
    setFileName(file?.name ?? "");
    if (!file) return;

    try {
      // Keep the relatively large spreadsheet parser out of the initial items-page bundle.
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!firstSheet) throw new Error("missing sheet");
      const sheetRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: "",
        raw: false,
      });
      if (sheetRows.length === 0) {
        setError("الملف فارغ.");
        return;
      }
      if (sheetRows.length > MAX_IMPORT_ROWS) {
        setError(`الحد الأقصى هو ${MAX_IMPORT_ROWS} صفًا في المرة الواحدة.`);
        return;
      }
      setRows(sheetRows.map((row, index) => ({ ...mapSheetRow(row), key: index })));
    } catch {
      setError("تعذّر قراءة الملف. تأكد أنه Excel أو CSV صالح.");
    }
  }

  function updateRow(key: number, field: EditableField, value: string) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
    setError(null);
    setResult(null);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
    setResult(null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (rows.length === 0) {
      setError("اختر ملفًا يحتوي على صفوف.");
      return;
    }
    if (invalidRows > 0) {
      setError("أكمل الاسم بالعربية للصفوف المحددة بالأحمر أو احذفها.");
      return;
    }

    const formData = new FormData();
    formData.set(
      "rows",
      JSON.stringify(
        rows.map((row) => ({
          name_ar: row.name_ar,
          name_en: row.name_en,
          barcode: row.barcode,
          category: row.category,
          unit: row.unit,
        })),
      ),
    );
    startTransition(async () => {
      const nextResult = await importItems(formData);
      setResult(nextResult);
      if ("added" in nextResult && nextResult.errors.length === 0) {
        setRows([]);
        setFileName("");
        setFileInputKey((key) => key + 1);
      }
    });
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "items-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="secondary" />}>
        <Upload className="size-4" />
        استيراد Excel
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>استيراد أصناف من ملف</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="min-h-0 space-y-3 overflow-hidden">
          <p className="text-sm text-muted-foreground">
            اختر Excel أو CSV، راجع الصفوف وعدّلها أو احذفها، ثم نفّذ الاستيراد.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-64 flex-1 space-y-1">
              <Label htmlFor="file">الملف</Label>
              <input
                key={fileInputKey}
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={readFile}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
              <Download className="size-4" />
              تنزيل القالب
            </Button>
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>
                  معاينة: <strong>{rows.length}</strong> صف
                  {fileName ? ` — ${fileName}` : ""}
                </span>
                {invalidRows > 0 && (
                  <span className="text-destructive">{invalidRows} صفوف ناقصة</span>
                )}
                {duplicateKeys.size > 0 && (
                  <span className="text-amber-700">
                    توجد باركودات مكررة؛ سيُستورد أول صف فقط.
                  </span>
                )}
              </div>
              <div className="max-h-[50vh] overflow-auto rounded-md border">
                <table className="w-full min-w-4xl text-xs">
                  <thead className="sticky top-0 z-10 border-b bg-background">
                    <tr>
                      <th className="w-12 p-2 text-start font-medium">#</th>
                      {columns.map((column) => (
                        <th key={column.field} className="min-w-40 p-2 text-start font-medium">
                          {column.label}
                          {column.required ? " *" : ""}
                        </th>
                      ))}
                      <th className="w-12 p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const missingName = !row.name_ar.trim();
                      const duplicate = duplicateKeys.has(row.key);
                      return (
                        <tr
                          key={row.key}
                          className={`border-b last:border-0 ${
                            missingName ? "bg-destructive/5" : duplicate ? "bg-amber-50/60" : ""
                          }`}
                        >
                          <td className="p-2 text-muted-foreground">{index + 1}</td>
                          {columns.map((column) => (
                            <td key={column.field} className="p-1.5">
                              <input
                                value={row[column.field]}
                                onChange={(event) =>
                                  updateRow(row.key, column.field, event.target.value)
                                }
                                aria-label={`${column.label} للصف ${index + 1}`}
                                aria-invalid={column.field === "name_ar" && missingName}
                                className="w-full rounded border border-input bg-transparent px-2 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
                              />
                            </td>
                          ))}
                          <td className="p-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removeRow(row.key)}
                              aria-label={`حذف الصف ${index + 1}`}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && "error" in result && (
            <p className="text-sm text-destructive">{result.error}</p>
          )}
          {result && "added" in result && (
            <div className="space-y-1 rounded-md border p-3 text-sm">
              <p className="text-green-700">تمت إضافة {result.added} صنف.</p>
              {result.skipped > 0 && (
                <p className="text-muted-foreground">
                  تم تخطّي {result.skipped} (باركود مكرر).
                </p>
              )}
              {result.errors.length > 0 && (
                <ul className="list-inside list-disc text-destructive">
                  {result.errors.slice(0, 5).map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>…و{result.errors.length - 5} أخطاء أخرى</li>
                  )}
                </ul>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || rows.length === 0 || invalidRows > 0}
            >
              {pending ? "جارٍ الاستيراد…" : `استيراد ${rows.length || ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
