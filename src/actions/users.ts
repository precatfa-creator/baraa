"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProfile } from "@/lib/auth";
import { USERNAME_RE, ID_CODE_RE } from "@/lib/identifier";
import type { AdminFormState } from "./pharmacies";

// Optional alternate login identifiers. username is lowercased and must contain a
// letter (so it never collides with an all-digit id_code); id_code is 6 digits.
const username = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || USERNAME_RE.test(v), {
    message: "اسم المستخدم: 3-30 من الأحرف/الأرقام/الشرطة السفلية ويحتوي حرفًا.",
  });
const idCode = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || ID_CODE_RE.test(v), { message: "الرمز يجب أن يكون 6 أرقام." });

// Admins may create these roles within their own company (never super_admin).
const schema = z
  .object({
    email: z.string().trim().email("بريد إلكتروني غير صالح."),
    password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل."),
    full_name: z.string().trim().min(1, "الاسم مطلوب."),
    role: z.enum(["company_admin", "pharmacist", "sales_rep"]),
    username,
    id_code: idCode,
    pharmacy_id: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable(),
  })
  .refine((d) => d.role !== "pharmacist" || d.pharmacy_id, {
    message: "اختر صيدلية للصيدلي.",
    path: ["pharmacy_id"],
  });

export async function createUser(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await getAdminProfile();
  if (!admin?.company_id) return { error: "صلاحية غير كافية." };

  const parsed = schema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    full_name: formData.get("full_name") ?? "",
    role: formData.get("role") ?? "",
    username: formData.get("username") ?? "",
    id_code: formData.get("id_code") ?? "",
    pharmacy_id: formData.get("pharmacy_id") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, password, full_name, role, username, id_code, pharmacy_id } = parsed.data;

  // A trigger on auth.users can't know company_id; the admin action supplies it.
  // Service role creates the auth user (GoTrue fills token columns correctly).
  const svc = createAdminClient();
  const { data: created, error: authError } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    return { error: authError?.message.includes("already") ? "البريد مستخدم مسبقًا." : "تعذر إنشاء المستخدم." };
  }

  const { error: profileError } = await svc.from("profiles").insert({
    id: created.user.id,
    company_id: admin.company_id,
    pharmacy_id: role === "pharmacist" ? pharmacy_id : null,
    full_name,
    role,
    username,
    id_code,
  });
  if (profileError) {
    // Roll back the auth user so we don't leave an orphan with no profile.
    await svc.auth.admin.deleteUser(created.user.id);
    if (profileError.code === "23505") {
      const detail = `${profileError.message} ${profileError.details ?? ""}`.toLowerCase();
      if (detail.includes("username")) return { error: "اسم المستخدم مستخدم مسبقًا." };
      if (detail.includes("id_code")) return { error: "الرمز مستخدم مسبقًا." };
    }
    console.error("createUser profile:", profileError.code, profileError.message);
    return { error: "تعذر إنشاء ملف المستخدم." };
  }

  revalidatePath("/users");
  return null;
}

// Activate/deactivate a user. Admins cannot deactivate themselves.
export async function setUserActive(id: string, isActive: boolean): Promise<void> {
  const admin = await getAdminProfile();
  if (!admin || id === admin.id) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: isActive }).eq("id", id);
  revalidatePath("/users");
}
