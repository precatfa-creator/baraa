"use client";

import { useActionState } from "react";
import { changeOwnPassword, type PasswordState } from "@/actions/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordState, FormData>(
    changeOwnPassword,
    null,
  );

  return (
    <form action={formAction} className="glass-panel max-w-md space-y-4 p-4">
      <div className="space-y-1">
        <Label htmlFor="current_password">كلمة المرور الحالية</Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">كلمة المرور الجديدة</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="password_confirm">تأكيد كلمة المرور الجديدة</Label>
        <Input
          id="password_confirm"
          name="password_confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-green-700">{state.success}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "جارٍ التغيير…" : "تغيير كلمة المرور"}
      </Button>
    </form>
  );
}
