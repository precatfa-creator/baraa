"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

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

  revalidatePath("/items");
  return null;
}
