"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completePasswordReset, type RecoveryState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState<RecoveryState, FormData>(
    completePasswordReset,
    null,
  );

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4">
      <form action={formAction} className="glass-panel w-full max-w-sm space-y-4 p-6">
        <h1 className="text-center text-xl font-bold">كلمة مرور جديدة</h1>
        <div className="space-y-1">
          <Label htmlFor="password">كلمة المرور الجديدة</Label>
          <Input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="password_confirm">تأكيد كلمة المرور الجديدة</Label>
          <Input
            id="password_confirm"
            name="password_confirm"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </div>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        {state?.success && <p className="text-sm text-green-700">{state.success}</p>}
        {!state?.success && (
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "جارٍ التغيير…" : "تغيير كلمة المرور"}
          </Button>
        )}
        <Link href="/login" className="block text-center text-sm text-primary hover:underline">
          تسجيل الدخول
        </Link>
      </form>
    </div>
  );
}
