"use client";

import { useActionState, useState } from "react";
import { createUser, updateUser } from "@/actions/users";
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

export type UserFields = {
  id: string;
  full_name: string;
  username: string | null;
  id_code: string | null;
  role: string;
  pharmacy_id: string | null;
};

export function UserDialog({
  pharmacies,
  user,
  triggerLabel,
  triggerVariant = "default",
  triggerSize = "default",
}: {
  pharmacies: { id: string; name: string }[];
  user?: UserFields;
  triggerLabel?: string;
  triggerVariant?: "default" | "ghost" | "secondary" | "outline";
  triggerSize?: "default" | "sm";
}) {
  const editing = !!user;
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user?.role ?? "pharmacist");
  const [state, formAction, pending] = useActionState<AdminFormState, FormData>(
    async (prev, formData) => {
      const result = editing ? await updateUser(prev, formData) : await createUser(prev, formData);
      if (result === null) setOpen(false);
      return result;
    },
    null,
  );

  const title = editing ? "تعديل مستخدم" : "إضافة مستخدم";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        {triggerLabel ?? title}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {editing && <input type="hidden" name="id" value={user.id} />}
          <div className="space-y-1">
            <Label htmlFor="full_name">الاسم</Label>
            <Input id="full_name" name="full_name" required defaultValue={user?.full_name ?? ""} />
          </div>
          {!editing && (
            <div className="space-y-1">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" name="email" type="email" required autoComplete="off" />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="password">
              {editing ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required={!editing}
              autoComplete="new-password"
              placeholder={editing ? "اتركه فارغًا لعدم التغيير" : undefined}
            />
          </div>
          {editing && (
            <div className="space-y-1">
              <Label htmlFor="password_confirm">تأكيد كلمة المرور الجديدة</Label>
              <Input
                id="password_confirm"
                name="password_confirm"
                type="password"
                autoComplete="new-password"
                placeholder="أعد كتابة كلمة المرور"
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="username">اسم المستخدم (اختياري)</Label>
              <Input
                id="username"
                name="username"
                autoComplete="off"
                placeholder="مثال: ahmed01"
                defaultValue={user?.username ?? ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="id_code">الرمز (6 أرقام، اختياري)</Label>
              <Input
                id="id_code"
                name="id_code"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                placeholder="123456"
                defaultValue={user?.id_code ?? ""}
              />
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
              <select
                id="pharmacy_id"
                name="pharmacy_id"
                defaultValue={user?.pharmacy_id ?? ""}
                className={selectClass}
              >
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
