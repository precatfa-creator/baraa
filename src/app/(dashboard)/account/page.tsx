import { PasswordForm } from "./password-form";

export default function AccountPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">حسابي</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          غيّر كلمة مرورك. ستُنهى الجلسات المفتوحة على الأجهزة الأخرى.
        </p>
      </div>
      <PasswordForm />
    </div>
  );
}
