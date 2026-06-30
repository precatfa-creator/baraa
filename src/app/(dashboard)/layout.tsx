import { redirect } from "next/navigation";
import { getCurrentProfile, isAdmin, type Role } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { logout } from "../(auth)/actions";
import { Button } from "@/components/ui/button";
import { NavLinks } from "./nav-links";

const roleLabel: Record<Role, string> = {
  super_admin: "مدير المنصة",
  company_admin: "مدير الشركة",
  pharmacist: "صيدلي",
  sales_rep: "مندوب مبيعات",
};

const baseNav = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/requests", label: "النواقص" },
  { href: "/batches", label: "الدُفعات" },
  { href: "/unavailable", label: "غير المتوفرة" },
  { href: "/items", label: "الأصناف" },
];

// Admin-only management screens (Phase 7).
const adminNav = [
  { href: "/pharmacies", label: "الصيدليات" },
  { href: "/users", label: "المستخدمون" },
  { href: "/assignments", label: "التعيينات" },
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Middleware blocks unauthenticated users; this also blocks authenticated users
  // whose profile is missing/inactive (AUTH.md §3).
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  const nav = isAdmin(profile.role) ? [...baseNav, ...adminNav] : baseNav;

  return (
    <div className="flex min-h-full flex-col">
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
