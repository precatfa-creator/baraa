"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isIdCode } from "@/lib/identifier";
import { validateNewPassword } from "@/lib/password";
import { recordAuditEvent } from "@/lib/audit";

export type LoginState = { error: string } | null;
export type RecoveryState = { error?: string; success?: string } | null;

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

async function requestOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL).origin;
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("Cannot determine password recovery origin");
  return `${protocol}://${host}`;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) {
    return { error: "أدخل بيانات الدخول وكلمة المرور." };
  }

  const email = await resolveEmail(identifier);
  if (!email) {
    await recordAuditEvent(createAdminClient(), {
      eventType: "auth.login_failed",
      entityType: "session",
      action: "login_failed",
      summary: "Failed login attempt for unknown account",
      details: {
        identifier,
        identifier_type: isIdCode(identifier) ? "id_code" : "username",
      },
    });
    return { error: "بيانات الدخول غير صحيحة." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await recordAuditEvent(createAdminClient(), {
      eventType: "auth.login_failed",
      entityType: "session",
      action: "login_failed",
      summary: "Failed login attempt",
      details: {
        identifier,
        identifier_type: identifier.includes("@")
          ? "email"
          : isIdCode(identifier)
            ? "id_code"
            : "username",
      },
    });
    return { error: "بيانات الدخول غير صحيحة." };
  }

  // Block sign-in for users without an active profile (AUTH.md §3).
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .single();
  if (!profile || !profile.is_active) {
    await recordAuditEvent(supabase, {
      eventType: "auth.login_blocked",
      entityType: "session",
      entityId: data.user.id,
      action: "login_blocked",
      summary: "Login blocked for inactive account",
    });
    await supabase.auth.signOut();
    return { error: "لا يوجد حساب نشط مرتبط بهذا المستخدم." };
  }

  await recordAuditEvent(supabase, {
    eventType: "auth.login",
    entityType: "session",
    entityId: data.user.id,
    action: "login",
    summary: "User logged in",
    details: {
      identifier_type: identifier.includes("@")
        ? "email"
        : isIdCode(identifier)
          ? "id_code"
          : "username",
    },
  });
  redirect("/dashboard");
}

export async function requestPasswordReset(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { error: "أدخل البريد أو اسم المستخدم أو الرمز." };

  const email = await resolveEmail(identifier);
  if (email) {
    const supabase = await createClient();
    const origin = await requestOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback`,
    });
    if (!error) {
      await recordAuditEvent(createAdminClient(), {
        eventType: "auth.password_reset_requested",
        entityType: "user",
        action: "password_reset_requested",
        summary: "Password reset requested",
        details: { email },
      });
    }
    // Keep the response generic so this form cannot enumerate accounts.
    if (error) console.error("requestPasswordReset:", error.message);
  }

  return {
    success: "إذا كانت البيانات صحيحة، أرسلنا رابط تغيير كلمة المرور إلى البريد المرتبط بالحساب.",
  };
}

export async function completePasswordReset(
  _prev: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirm") ?? "");
  const validationError = validateNewPassword(password, confirmation);
  if (validationError) return { error: validationError };

  const cookieStore = await cookies();
  if (cookieStore.get("password_recovery")?.value !== "1") {
    return { error: "رابط الاستعادة غير صالح أو انتهت صلاحيته." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "رابط الاستعادة غير صالح أو انتهت صلاحيته." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("completePasswordReset:", error.message);
    return { error: "تعذر تغيير كلمة المرور. اطلب رابطًا جديدًا." };
  }

  await recordAuditEvent(supabase, {
    eventType: "auth.password_reset_completed",
    entityType: "user",
    entityId: user.id,
    action: "password_reset_completed",
    summary: "Password reset completed",
  });
  cookieStore.delete("password_recovery");
  await supabase.auth.signOut();
  return { success: "تم تغيير كلمة المرور. يمكنك الآن تسجيل الدخول." };
}

export async function logout() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await recordAuditEvent(supabase, {
    eventType: "auth.logout",
    entityType: "session",
    entityId: user?.id,
    action: "logout",
    summary: "User logged out",
  });
  await supabase.auth.signOut();
  redirect("/login");
}
