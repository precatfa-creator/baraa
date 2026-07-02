export const MIN_PASSWORD_LENGTH = 8;

export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل.`;
  }
  if (password !== confirmation) {
    return "كلمتا المرور غير متطابقتين.";
  }
  return null;
}
