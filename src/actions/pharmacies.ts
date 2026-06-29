"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile } from "@/lib/auth";

export type AdminFormState = { error: string } | null;

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

const schema = z.object({
  name: z.string().trim().min(1, "اسم الصيدلية مطلوب."),
  address: optionalText,
  phone: optionalText,
});

export async function createPharmacy(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await getAdminProfile();
  if (!admin?.company_id) return { error: "صلاحية غير كافية." };

  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("pharmacies")
    .insert({ ...parsed.data, company_id: admin.company_id });
  if (error) {
    console.error("createPharmacy:", error.code, error.message);
    return { error: "تعذر حفظ الصيدلية." };
  }
  revalidatePath("/pharmacies");
  return null;
}

export async function updatePharmacy(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await getAdminProfile();
  if (!admin) return { error: "صلاحية غير كافية." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "الصيدلية غير موجودة." };

  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("pharmacies").update(parsed.data).eq("id", id);
  if (error) {
    console.error("updatePharmacy:", error.code, error.message);
    return { error: "تعذر حفظ الصيدلية." };
  }
  revalidatePath("/pharmacies");
  return null;
}

// Activate/deactivate (soft state); RLS confirms admin + same company.
export async function setPharmacyActive(id: string, isActive: boolean): Promise<void> {
  const admin = await getAdminProfile();
  if (!admin) return;
  const supabase = await createClient();
  await supabase.from("pharmacies").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/pharmacies");
}
