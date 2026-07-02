"use server";

import { revalidatePath } from "next/cache";
import * as XLSX from "xlsx";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile, getCurrentProfile } from "@/lib/auth";

// Empty optional text fields arrive as "" from forms; treat them as null.
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const itemSchema = z.object({
  name_ar: z.string().trim().min(1, "اسم الصنف بالعربية مطلوب."),
  name_en: optionalText,
  barcode: optionalText,
  category: optionalText,
  unit: optionalText,
});

export type ItemFormState = { error: string } | null;

// Register the chosen category/unit in the per-tenant pick-lists so they appear
// in the dropdown next time. Best-effort: the item is already saved, and a failed
// lookup write (or a typo creating a junk entry) must not fail the item mutation.
// ponytail: typos accumulate as list entries; add a lookups management screen if that bites.
async function registerLookups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  category: string | null,
  unit: string | null,
) {
  if (category) {
    await supabase
      .from("item_categories")
      .upsert({ company_id: companyId, name: category }, { onConflict: "company_id,name", ignoreDuplicates: true });
  }
  if (unit) {
    await supabase
      .from("item_units")
      .upsert({ company_id: companyId, name: unit }, { onConflict: "company_id,name", ignoreDuplicates: true });
  }
}

function parse(formData: FormData) {
  return itemSchema.safeParse({
    name_ar: formData.get("name_ar") ?? "",
    name_en: formData.get("name_en") ?? "",
    barcode: formData.get("barcode") ?? "",
    category: formData.get("category") ?? "",
    unit: formData.get("unit") ?? "",
  });
}

// 23505 = unique_violation; the only unique constraint on items is barcode-per-company.
// Unexpected codes are logged server-side (RLS denials, etc.) so failures aren't blind.
function toArabicError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "هذا الباركود مستخدم لصنف آخر.";
  console.error("item mutation failed:", error.code, error.message);
  return "تعذر حفظ الصنف. حاول مرة أخرى.";
}

export async function createItem(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // company_id comes from the trusted profile, not the form; RLS also requires
  // it to match the JWT claim and the caller to be an admin.
  const profile = await getCurrentProfile();
  if (!profile?.company_id) {
    return { error: "لا يمكن تحديد الشركة." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .insert({ ...parsed.data, company_id: profile.company_id, created_by: profile.id });
  if (error) {
    return { error: toArabicError(error) };
  }

  await registerLookups(supabase, profile.company_id, parsed.data.category, parsed.data.unit);
  revalidatePath("/items");
  return null;
}

export async function updateItem(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "الصنف غير موجود." };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // RLS (items_admin_update) enforces admin + same company; no company_id change here.
  const supabase = await createClient();
  const { error } = await supabase.from("items").update(parsed.data).eq("id", id);
  if (error) {
    return { error: toArabicError(error) };
  }

  const profile = await getCurrentProfile();
  if (profile?.company_id) {
    await registerLookups(supabase, profile.company_id, parsed.data.category, parsed.data.unit);
  }
  revalidatePath("/items");
  return null;
}

// Remove/restore an item (soft-delete via is_active; hard delete is unsafe —
// shortage_requests.item_id references items with no cascade). RLS (items_admin_update)
// confirms admin + same company. Deactivated items drop out of the request picker.
export async function setItemActive(id: string, isActive: boolean): Promise<void> {
  const admin = await getAdminProfile();
  if (!admin) return;
  const supabase = await createClient();
  await supabase.from("items").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/items");
}

// Permanent delete. RLS (items_admin_delete) confirms admin + same company.
// 23503 = foreign_key_violation: item is referenced by a shortage_request; steer
// the manager to deactivate instead of hard-delete.
export async function deleteItem(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await getAdminProfile();
  if (!admin) return { ok: false, error: "ليس لديك صلاحية." };
  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "الصنف مستخدم في طلبات؛ أوقفه بدل حذفه نهائيًا." };
    }
    console.error("deleteItem:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الصنف." };
  }
  revalidatePath("/items");
  return { ok: true };
}

// --- Bulk import from Excel/CSV -------------------------------------------------

// Map a sheet row (keyed by header text) to our fields, accepting Arabic or English
// headers in any order/case.
const HEADER_ALIASES = {
  name_ar: ["name_ar", "الاسم بالعربية", "الاسم العربي", "الاسم", "اسم الصنف", "name"],
  name_en: ["name_en", "الاسم بالإنجليزية", "english name", "english"],
  barcode: ["barcode", "الباركود", "باركود"],
  category: ["category", "التصنيف", "تصنيف"],
  unit: ["unit", "الوحدة", "وحدة"],
} as const;

const norm = (s: unknown) => String(s).trim().toLowerCase();

function pick(row: Record<string, unknown>, aliases: readonly string[]): string {
  for (const key of Object.keys(row)) {
    if (aliases.some((a) => norm(a) === norm(key))) {
      const v = row[key];
      return v == null ? "" : String(v).trim();
    }
  }
  return "";
}

export type ImportResult = { added: number; skipped: number; errors: string[] };

export async function importItems(formData: FormData): Promise<ImportResult | { error: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر ملفًا." };

  const profile = await getCurrentProfile();
  if (!profile?.company_id) return { error: "لا يمكن تحديد الشركة." };
  if (profile.role !== "company_admin" && profile.role !== "super_admin") {
    return { error: "ليس لديك صلاحية لاستيراد الأصناف." };
  }
  const companyId = profile.company_id;
  const userId = profile.id;

  let rows: Record<string, unknown>[];
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch {
    return { error: "تعذّر قراءة الملف. تأكد أنه Excel أو CSV صالح." };
  }
  if (rows.length === 0) return { error: "الملف فارغ." };

  const supabase = await createClient();
  // existing barcodes in this company (RLS-scoped) → skip dups, also dedupe within the file
  const { data: existing } = await supabase.from("items").select("barcode").not("barcode", "is", null);
  const seen = new Set<string>((existing ?? []).map((r) => r.barcode as string));

  const toInsert: Array<z.infer<typeof itemSchema> & { company_id: string; created_by: string }> = [];
  const errors: string[] = [];
  let skipped = 0;

  rows.forEach((row, i) => {
    const parsed = itemSchema.safeParse({
      name_ar: pick(row, HEADER_ALIASES.name_ar),
      name_en: pick(row, HEADER_ALIASES.name_en),
      barcode: pick(row, HEADER_ALIASES.barcode),
      category: pick(row, HEADER_ALIASES.category),
      unit: pick(row, HEADER_ALIASES.unit),
    });
    if (!parsed.success) {
      errors.push(`سطر ${i + 2}: ${parsed.error.issues[0].message}`); // +2: header row + 1-based
      return;
    }
    const barcode = parsed.data.barcode;
    if (barcode && seen.has(barcode)) {
      skipped++;
      return;
    }
    if (barcode) seen.add(barcode);
    toInsert.push({ ...parsed.data, company_id: companyId, created_by: userId });
  });

  let added = 0;
  if (toInsert.length > 0) {
    const { error, count } = await supabase.from("items").insert(toInsert, { count: "exact" });
    if (error) {
      console.error("import insert failed:", error.code, error.message);
      return { error: "تعذّر حفظ الأصناف. تأكد من الصلاحيات والبيانات." };
    }
    added = count ?? toInsert.length;

    // register imported categories/units in the pick-lists
    const cats = [...new Set(toInsert.map((r) => r.category).filter((v): v is string => !!v))];
    const units = [...new Set(toInsert.map((r) => r.unit).filter((v): v is string => !!v))];
    if (cats.length) {
      await supabase
        .from("item_categories")
        .upsert(cats.map((name) => ({ company_id: companyId, name })), { onConflict: "company_id,name", ignoreDuplicates: true });
    }
    if (units.length) {
      await supabase
        .from("item_units")
        .upsert(units.map((name) => ({ company_id: companyId, name })), { onConflict: "company_id,name", ignoreDuplicates: true });
    }
  }

  revalidatePath("/items");
  return { added, skipped, errors };
}
