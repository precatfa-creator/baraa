"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminProfile } from "@/lib/auth";
import { USERNAME_RE, ID_CODE_RE } from "@/lib/identifier";
import { MIN_PASSWORD_LENGTH, validateNewPassword } from "@/lib/password";
import type { AdminFormState } from "./pharmacies";
import { recordAuditEvent } from "@/lib/audit";

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

// Fields shared by create and edit. Admins manage these roles (never super_admin).
const base = {
  full_name: z.string().trim().min(1, "الاسم مطلوب."),
  role: z.enum(["company_admin", "pharmacist", "sales_rep"]),
  username,
  id_code: idCode,
  pharmacy_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
};
const pharmacistNeedsPharmacy = (d: { role: string; pharmacy_id: string | null }) =>
  d.role !== "pharmacist" || !!d.pharmacy_id;
const pharmacyMsg: { message: string; path: PropertyKey[] } = {
  message: "اختر صيدلية للصيدلي.",
  path: ["pharmacy_id"],
};

const schema = z
  .object({
    email: z.string().trim().email("بريد إلكتروني غير صالح."),
    password: z.string().min(MIN_PASSWORD_LENGTH, "كلمة المرور 8 أحرف على الأقل."),
    ...base,
  })
  .refine(pharmacistNeedsPharmacy, pharmacyMsg);

// Edit: password optional (blank = unchanged); email is not editable here.
const editSchema = z
  .object({
    password: z
      .string()
      .transform((v) => (v.trim() === "" ? null : v))
      .refine((v) => v === null || v.length >= MIN_PASSWORD_LENGTH, {
        message: "كلمة المرور 8 أحرف على الأقل.",
      }),
    password_confirm: z.string(),
    ...base,
  })
  .refine(pharmacistNeedsPharmacy, pharmacyMsg);

// Map a profiles unique-violation to a specific Arabic message (username/id_code).
function uniqueError(err: { code?: string; message: string; details?: string }): string | null {
  if (err.code !== "23505") return null;
  const detail = `${err.message} ${err.details ?? ""}`.toLowerCase();
  if (detail.includes("username")) return "اسم المستخدم مستخدم مسبقًا.";
  if (detail.includes("id_code")) return "الرمز مستخدم مسبقًا.";
  return null;
}

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
    const dup = uniqueError(profileError);
    if (dup) return { error: dup };
    console.error("createUser profile:", profileError.code, profileError.message);
    return { error: "تعذر إنشاء ملف المستخدم." };
  }

  await recordAuditEvent(await createClient(), {
    eventType: "user.created",
    entityType: "user",
    entityId: created.user.id,
    action: "create",
    summary: "Administrator created user",
    details: { email, full_name, role, username, id_code, pharmacy_id },
  });
  revalidatePath("/users");
  return null;
}

// Edit an existing user's profile (+ optional password reset). Email is unchanged.
export async function updateUser(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const admin = await getAdminProfile();
  if (!admin?.company_id) return { error: "صلاحية غير كافية." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "المستخدم غير موجود." };

  const parsed = editSchema.safeParse({
    password: formData.get("password") ?? "",
    password_confirm: formData.get("password_confirm") ?? "",
    full_name: formData.get("full_name") ?? "",
    role: formData.get("role") ?? "",
    username: formData.get("username") ?? "",
    id_code: formData.get("id_code") ?? "",
    pharmacy_id: formData.get("pharmacy_id") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { password, password_confirm, full_name, role, username, id_code, pharmacy_id } =
    parsed.data;
  if (password) {
    const passwordError = validateNewPassword(password, password_confirm);
    if (passwordError) return { error: passwordError };
  }

  // Don't let an admin change their own role — avoids self-lockout.
  if (id === admin.id && role !== admin.role) return { error: "لا يمكنك تغيير دورك." };

  const svc = createAdminClient();
  // Service-role writes bypass RLS, so enforce tenant ownership explicitly.
  const { data: target } = await svc
    .from("profiles")
    .select("company_id")
    .eq("id", id)
    .maybeSingle();
  if (!target || target.company_id !== admin.company_id) {
    return { error: "المستخدم غير موجود ضمن شركتك." };
  }

  const { error } = await svc
    .from("profiles")
    .update({ full_name, role, pharmacy_id: role === "pharmacist" ? pharmacy_id : null, username, id_code })
    .eq("id", id);
  if (error) {
    const dup = uniqueError(error);
    if (dup) return { error: dup };
    console.error("updateUser profile:", error.code, error.message);
    return { error: "تعذر تحديث المستخدم." };
  }

  if (password) {
    const { error: pwErr } = await svc.auth.admin.updateUserById(id, { password });
    if (pwErr) {
      console.error("updateUser password:", pwErr.message);
      return { error: "تعذر تحديث كلمة المرور." };
    }
    await recordAuditEvent(await createClient(), {
      eventType: "auth.password_changed_by_admin",
      entityType: "user",
      entityId: id,
      action: "password_changed_by_admin",
      summary: "Administrator changed user password",
      details: { target_user_id: id },
    });
  }

  await recordAuditEvent(await createClient(), {
    eventType: "user.updated",
    entityType: "user",
    entityId: id,
    action: "update",
    summary: "Administrator updated user",
    details: {
      target_user_id: id,
      full_name,
      role,
      username,
      id_code,
      pharmacy_id: role === "pharmacist" ? pharmacy_id : null,
      password_changed: Boolean(password),
    },
  });
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
