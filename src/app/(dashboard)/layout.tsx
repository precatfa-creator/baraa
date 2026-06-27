import Link from "next/link";

// Top nav mirrors the planned IA (design/sitemap.md). /items and /requests pages land in Phase 4/5.
const nav = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/requests", label: "النواقص" },
  { href: "/items", label: "الأصناف" },
];

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold">براء</span>
          <nav className="flex gap-4 text-sm text-zinc-600">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
