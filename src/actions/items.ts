"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile, getCurrentProfile } from "@/lib/auth";
import { MAX_IMPORT_ROWS } from "@/lib/item-import";

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
  const { error, count } = await supabase.from("items").delete({ count: "exact" }).eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "الصنف مستخدم في طلبات؛ أوقفه بدل حذفه نهائيًا." };
    }
    console.error("deleteItem:", error.code, error.message);
    return { ok: false, error: "تعذر حذف الصنف." };
  }
  // RLS returns no error but 0 rows when the caller isn't allowed to delete — don't
  // report a phantom success (e.g. if the items_admin_delete migration isn't applied).
  if (!count) {
    return { ok: false, error: "تعذر حذف الصنف." };
  }
  revalidatePath("/items");
  return { ok: true };
}

// --- Bulk import from Excel/CSV -------------------------------------------------

export type ImportResult = { added: number; skipped: number; errors: string[] };

export async function importItems(formData: FormData): Promise<ImportResult | { error: string }> {
  const serializedRows = formData.get("rows");
  if (typeof serializedRows !== "string") return { error: "لا توجد بيانات للاستيراد." };

  const profile = await getCurrentProfile();
  if (!profile?.company_id) return { error: "لا يمكن تحديد الشركة." };
  if (profile.role !== "company_admin" && profile.role !== "super_admin") {
    return { error: "ليس لديك صلاحية لاستيراد الأصناف." };
  }
  const companyId = profile.company_id;
  const userId = profile.id;

  let rows: unknown;
  try {
    rows = JSON.parse(serializedRows);
  } catch {
    return { error: "بيانات المعاينة غير صالحة." };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { error: "لا توجد صفوف للاستيراد." };
  if (rows.length > MAX_IMPORT_ROWS) {
    return { error: `الحد الأقصى للاستيراد هو ${MAX_IMPORT_ROWS} صفًا في المرة الواحدة.` };
  }

  const supabase = await createClient();
  // existing barcodes in this company (RLS-scoped) → skip dups, also dedupe within the file
  const { data: existing } = await supabase.from("items").select("barcode").not("barcode", "is", null);
  const seen = new Set<string>((existing ?? []).map((r) => r.barcode as string));

  const toInsert: Array<z.infer<typeof itemSchema> & { company_id: string; created_by: string }> = [];
  const errors: string[] = [];
  let skipped = 0;

  rows.forEach((row, i) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push(`صف ${i + 1}: بيانات غير صالحة.`);
      return;
    }
    const values = row as Record<string, unknown>;
    const parsed = itemSchema.safeParse({
      name_ar: String(values.name_ar ?? ""),
      name_en: String(values.name_en ?? ""),
      barcode: String(values.barcode ?? ""),
      category: String(values.category ?? ""),
      unit: String(values.unit ?? ""),
    });
    if (!parsed.success) {
      errors.push(`صف ${i + 1}: ${parsed.error.issues[0].message}`);
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
