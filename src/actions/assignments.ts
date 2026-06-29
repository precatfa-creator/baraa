"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile } from "@/lib/auth";
import type { AdminFormState } from "./pharmacies";

const schema = z.object({
  sales_rep_id: z.string().uuid("اختر مندوبًا."),
  pharmacy_id: z.string().uuid("اختر صيدلية."),
});

export async function createAssignment(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await getAdminProfile();
  if (!admin?.company_id) return { error: "صلاحية غير كافية." };

  const parsed = schema.safeParse({
    sales_rep_id: formData.get("sales_rep_id") ?? "",
    pharmacy_id: formData.get("pharmacy_id") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("sales_rep_assignments")
    .insert({ ...parsed.data, company_id: admin.company_id });
  if (error) {
    // 23505 = the unique active (rep,pharmacy) index.
    if (error.code === "23505") return { error: "هذا التعيين موجود بالفعل." };
    console.error("createAssignment:", error.code, error.message);
    return { error: "تعذر حفظ التعيين." };
  }
  revalidatePath("/assignments");
  return null;
}

export async function deactivateAssignment(id: string): Promise<void> {
  const admin = await getAdminProfile();
  if (!admin) return;
  const supabase = await createClient();
  await supabase.from("sales_rep_assignments").update({ is_active: false }).eq("id", id);
  revalidatePath("/assignments");
}
