"use server";

import { createClient } from "@/lib/supabase/server";
import { validateNewPassword } from "@/lib/password";

export type PasswordState = { error?: string; success?: string } | null;

export async function changeOwnPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const currentPassword = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirm") ?? "");

  if (!currentPassword) return { error: "أدخل كلمة المرور الحالية." };
  const validationError = validateNewPassword(password, confirmation);
  if (validationError) return { error: validationError };
  if (password === currentPassword) {
    return { error: "اختر كلمة مرور جديدة مختلفة عن الحالية." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "انتهت الجلسة. سجّل الدخول مجددًا." };

  // Reauthenticate before changing a password even when Supabase's optional
  // secure-password-change setting is disabled.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { error: "كلمة المرور الحالية غير صحيحة." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error("changeOwnPassword:", error.message);
    return { error: "تعذر تغيير كلمة المرور." };
  }

  // Keep this device signed in, but revoke other sessions after the change.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) console.error("changeOwnPassword signOut others:", signOutError.message);

  return { success: "تم تغيير كلمة المرور." };
}
