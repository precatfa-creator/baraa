import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile, type Role } from "@/lib/auth";
import { setUserActive } from "@/actions/users";
import { ActiveToggle } from "@/components/active-toggle";
import { UserDialog } from "./user-dialog";

const roleLabel: Record<Role, string> = {
  super_admin: "مدير المنصة",
  company_admin: "مدير الشركة",
  pharmacist: "صيدلي",
  sales_rep: "مندوب مبيعات",
};

export default async function UsersPage() {
  const admin = await getAdminProfile();
  if (!admin) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: users }, { data: pharmacies }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, pharmacies(name)")
      .order("full_name"),
    supabase.from("pharmacies").select("id, name").eq("is_active", true).order("name"),
  ]);

  const rows = (users ?? []) as unknown as {
    id: string;
    full_name: string;
    role: Role;
    is_active: boolean;
    pharmacies: { name: string } | null;
  }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">المستخدمون</h1>
        <UserDialog pharmacies={pharmacies ?? []} />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-medium">الاسم</th>
              <th className="p-3 text-start font-medium">الدور</th>
              <th className="p-3 text-start font-medium">الصيدلية</th>
              <th className="p-3 text-start font-medium">الحالة</th>
              <th className="p-3 text-start font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3">{u.full_name}</td>
                <td className="p-3 text-muted-foreground">{roleLabel[u.role]}</td>
                <td className="p-3 text-muted-foreground">{u.pharmacies?.name ?? "—"}</td>
                <td className="p-3">{u.is_active ? "نشط" : "متوقف"}</td>
                <td className="p-3 text-end">
                  {/* No self-deactivate; the action also guards this. */}
                  {u.id !== admin.id && (
                    <ActiveToggle id={u.id} active={u.is_active} action={setUserActive} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
