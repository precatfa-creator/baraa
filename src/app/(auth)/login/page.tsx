"use client";

import { useActionState } from "react";
import { login, type LoginState } from "../actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, null);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4">
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-2xl font-bold">براء</h1>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="البريد الإلكتروني"
          className={inputClass}
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="كلمة المرور"
          className={inputClass}
        />
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "جارٍ الدخول…" : "تسجيل الدخول"}
        </Button>
      </form>
    </div>
  );
}
