import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile } from "@/lib/auth";
import { setPharmacyActive } from "@/actions/pharmacies";
import { ActiveToggle } from "@/components/active-toggle";
import { PharmacyDialog, type PharmacyFields } from "./pharmacy-dialog";

export default async function PharmaciesPage() {
  const admin = await getAdminProfile();
  if (!admin) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("pharmacies")
    .select("id, name, address, phone, is_active")
    .order("name");
  const pharmacies = (data ?? []) as (PharmacyFields & { is_active: boolean })[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">الصيدليات</h1>
        <PharmacyDialog triggerLabel="إضافة صيدلية" />
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-medium">الاسم</th>
              <th className="p-3 text-start font-medium">الهاتف</th>
              <th className="p-3 text-start font-medium">الحالة</th>
              <th className="p-3 text-start font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {pharmacies.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-3">{p.name}</td>
                <td className="p-3 text-muted-foreground">{p.phone ?? "—"}</td>
                <td className="p-3">{p.is_active ? "نشطة" : "متوقفة"}</td>
                <td className="flex justify-end gap-1 p-3">
                  <PharmacyDialog
                    pharmacy={p}
                    triggerLabel="تعديل"
                    triggerVariant="ghost"
                    triggerSize="sm"
                  />
                  <ActiveToggle id={p.id} active={p.is_active} action={setPharmacyActive} />
                </td>
              </tr>
            ))}
            {pharmacies.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-muted-foreground">
                  لا توجد صيدليات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
