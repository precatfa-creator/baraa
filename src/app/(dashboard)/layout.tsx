import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile, type Role } from "@/lib/auth";
import { logout } from "../(auth)/actions";
import { Button } from "@/components/ui/button";

const roleLabel: Record<Role, string> = {
  super_admin: "مدير المنصة",
  company_admin: "مدير الشركة",
  pharmacist: "صيدلي",
  sales_rep: "مندوب مبيعات",
};

// Planned IA (design/sitemap.md). /items and /requests pages land in Phase 4/5.
const nav = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/requests", label: "النواقص" },
  { href: "/items", label: "الأصناف" },
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

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold">براء</span>
          <nav className="flex gap-4 text-sm text-muted-foreground">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {profile.full_name} · {roleLabel[profile.role]}
            </span>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
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
