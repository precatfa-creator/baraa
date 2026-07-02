"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type RecoveryState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState<RecoveryState, FormData>(
    requestPasswordReset,
    null,
  );

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4">
      <form action={formAction} className="glass-panel w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-center text-xl font-bold">استعادة كلمة المرور</h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            سنرسل رابط الاستعادة إلى البريد المرتبط بالحساب.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="identifier">البريد أو اسم المستخدم أو الرمز</Label>
          <Input
            id="identifier"
            name="identifier"
            required
            autoComplete="username"
          />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && <p className="text-sm text-green-700">{state.success}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "جارٍ الإرسال…" : "إرسال رابط الاستعادة"}
        </Button>
        <Link href="/login" className="block text-center text-sm text-primary hover:underline">
          العودة إلى تسجيل الدخول
        </Link>
      </form>
    </div>
  );
}
