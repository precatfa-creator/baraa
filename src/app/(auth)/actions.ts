"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isIdCode } from "@/lib/identifier";

export type LoginState = { error: string } | null;

// Map a username / id_code login identifier to the account's email. Uses the
// service-role client because the caller is anonymous (RLS blocks reading other
// profiles). Returns null on no match — the caller shows the generic error.
async function resolveEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) return identifier; // already an email
  const svc = createAdminClient();
  const query = isIdCode(identifier)
    ? svc.from("profiles").select("id").eq("id_code", identifier)
    : svc.from("profiles").select("id").eq("username", identifier.toLowerCase());
  const { data: prof } = await query.maybeSingle();
  if (!prof) return null;
  const { data } = await svc.auth.admin.getUserById(prof.id);
  return data.user?.email ?? null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) {
    return { error: "أدخل بيانات الدخول وكلمة المرور." };
  }

  const email = await resolveEmail(identifier);
  if (!email) {
    return { error: "بيانات الدخول غير صحيحة." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: "بيانات الدخول غير صحيحة." };
  }

  // Block sign-in for users without an active profile (AUTH.md §3).
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .single();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "لا يوجد حساب نشط مرتبط بهذا المستخدم." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
