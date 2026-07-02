import { redirect } from "next/navigation";
import { getCurrentProfile, type Role } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { logout } from "../(auth)/actions";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";
import { WorkflowRealtime } from "@/components/workflow-realtime";
import { navigationForRole } from "@/lib/navigation";
import { PageSwipeNavigation } from "./page-swipe-navigation";

const roleLabel: Record<Role, string> = {
  super_admin: "مدير المنصة",
  company_admin: "مدير الشركة",
  pharmacist: "صيدلي",
  sales_rep: "مندوب مبيعات",
};

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Middleware blocks unauthenticated users; this also blocks authenticated users
  // whose profile is missing/inactive (AUTH.md §3).
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  const nav = navigationForRole(profile.role);

  return (
    <div className="flex min-h-full flex-col">
      <WorkflowRealtime companyId={profile.company_id} />
      <header className="glass-bar sticky top-0 z-20">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="text-lg font-bold text-primary">براء</span>
          {/* nav scrolls horizontally on narrow screens instead of crowding the row */}
          <NavLinks items={nav} />
          <div className="ms-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {profile.full_name} · {roleLabel[profile.role]}
            </span>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="size-4" />
                خروج
              </Button>
            </form>
          </div>
        </div>
      </header>
      <PageSwipeNavigation items={nav}>{children}</PageSwipeNavigation>
    </div>
  );
}
