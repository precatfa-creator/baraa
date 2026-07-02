"use client";

import { useActionState, useState } from "react";
import { createUser } from "@/actions/users";
import type { AdminFormState } from "@/actions/pharmacies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const selectClass = "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm";

const roleOptions: { value: string; label: string }[] = [
  { value: "pharmacist", label: "صيدلي" },
  { value: "sales_rep", label: "مندوب مبيعات" },
  { value: "company_admin", label: "مدير الشركة" },
];

export function UserDialog({ pharmacies }: { pharmacies: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("pharmacist");
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(
    async (prev, formData) => {
      const result = await createUser(prev, formData);
      if (result === null) setOpen(false);
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>إضافة مستخدم</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إضافة مستخدم</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="full_name">الاسم</Label>
            <Input id="full_name" name="full_name" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <Input id="email" name="email" type="email" required autoComplete="off" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">كلمة المرور</Label>
            <Input id="password" name="password" type="password" required autoComplete="new-password" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="username">اسم المستخدم (اختياري)</Label>
              <Input id="username" name="username" autoComplete="off" placeholder="مثال: ahmed01" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="id_code">الرمز (6 أرقام، اختياري)</Label>
              <Input id="id_code" name="id_code" inputMode="numeric" maxLength={6} autoComplete="off" placeholder="123456" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="role">الدور</Label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={selectClass}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {role === "pharmacist" && (
            <div className="space-y-1">
              <Label htmlFor="pharmacy_id">الصيدلية</Label>
              <select id="pharmacy_id" name="pharmacy_id" className={selectClass}>
                <option value="">— اختر —</option>
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
