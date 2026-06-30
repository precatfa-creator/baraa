"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PackageSearch,
  ClipboardList,
  Pill,
  Building2,
  Users,
  Network,
  type LucideIcon,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/requests": PackageSearch,
  "/batches": ClipboardList,
  "/items": Pill,
  "/pharmacies": Building2,
  "/users": Users,
  "/assignments": Network,
};

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto text-sm">
      {items.map((item) => {
        const Icon = icons[item.href];
        // active when on the page or any sub-route (e.g. /requests/[id])
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 transition-colors ${
              active
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="size-4" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
