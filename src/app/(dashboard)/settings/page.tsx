import { redirect } from "next/navigation";
import { getAdminProfile } from "@/lib/auth";
import {
  deleteAllRequests,
  deleteAllBatches,
  deleteAllItems,
  deleteAllPharmacies,
  deleteAllUsers,
} from "@/actions/admin-reset";
import { DangerButton } from "./danger-button";

export default async function SettingsPage() {
  // Admin-only; the nav link is admin-gated too, but defend the route directly.
  if (!(await getAdminProfile())) redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الإعدادات</h1>

      <section className="glass-panel space-y-4 border-destructive/40 p-4">
        <div>
          <h2 className="text-base font-semibold text-destructive">منطقة الخطر</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            حذف نهائي لا يمكن التراجع عنه. احذف بالترتيب: الطلبات ثم الدفعات ثم الأصناف والصيدليات ثم المستخدمين.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <DangerButton
            label="حذف كل الطلبات"
            description="سيتم حذف جميع طلبات النواقص وسجل حالاتها نهائيًا لكل الشركات."
            successMsg="تم حذف الطلبات"
            action={deleteAllRequests}
          />
          <DangerButton
            label="حذف كل الدفعات"
            description="سيتم حذف جميع الدفعات نهائيًا وفكّ ارتباطها بالطلبات."
            successMsg="تم حذف الدفعات"
            action={deleteAllBatches}
          />
          <DangerButton
            label="حذف كل الأصناف"
            description="سيتم حذف جميع الأصناف نهائيًا. احذف الطلبات أولًا إن كانت تستخدم أصنافًا."
            successMsg="تم حذف الأصناف"
            action={deleteAllItems}
          />
          <DangerButton
            label="حذف كل الصيدليات"
            description="سيتم حذف جميع الصيدليات والتعيينات نهائيًا. احذف الطلبات والدفعات أولًا."
            successMsg="تم حذف الصيدليات"
            action={deleteAllPharmacies}
          />
          <DangerButton
            label="حذف كل المستخدمين (عدا omar@baraa.ly)"
            description="سيتم حذف جميع المستخدمين نهائيًا ما عدا omar@baraa.ly وحسابك الحالي."
            successMsg="تم حذف المستخدمين"
            action={deleteAllUsers}
          />
        </div>
      </section>
    </div>
  );
}
