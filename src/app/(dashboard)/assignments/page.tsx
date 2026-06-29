import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminProfile } from "@/lib/auth";
import { AssignmentDialog, RemoveAssignment } from "./assignment-form";

export default async function AssignmentsPage() {
  const admin = await getAdminProfile();
  if (!admin) redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: assignments }, { data: reps }, { data: pharmacies }] = await Promise.all([
    supabase
      .from("sales_rep_assignments")
      .select("id, profiles:sales_rep_id(full_name), pharmacies(name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "sales_rep")
      .eq("is_active", true)
      .order("full_name"),
    supabase.from("pharmacies").select("id, name").eq("is_active", true).order("name"),
  ]);

  const rows = (assignments ?? []) as unknown as {
    id: string;
    profiles: { full_name: string } | null;
    pharmacies: { name: string } | null;
  }[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">تعيينات المندوبين</h1>
        <AssignmentDialog
          reps={(reps ?? []).map((r) => ({ id: r.id, name: r.full_name }))}
          pharmacies={pharmacies ?? []}
        />
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="p-3 text-start font-medium">المندوب</th>
              <th className="p-3 text-start font-medium">الصيدلية</th>
              <th className="p-3 text-start font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="p-3">{a.profiles?.full_name ?? "—"}</td>
                <td className="p-3">{a.pharmacies?.name ?? "—"}</td>
                <td className="p-3 text-end">
                  <RemoveAssignment id={a.id} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-muted-foreground">
                  لا توجد تعيينات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
