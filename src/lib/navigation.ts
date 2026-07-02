import type { Role } from "./auth";

export type NavigationItem = {
  href: string;
  label: string;
};

const baseNav: NavigationItem[] = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/requests", label: "النواقص" },
  { href: "/batches", label: "الدُفعات" },
  { href: "/unavailable", label: "غير المتوفرة" },
  { href: "/trends", label: "الأكثر طلبًا" },
  { href: "/items", label: "الأصناف" },
  { href: "/account", label: "حسابي" },
];

const pharmacistNav: NavigationItem[] = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/requests", label: "طلباتي" },
  { href: "/account", label: "حسابي" },
];

const salesRepNav: NavigationItem[] = [
  { href: "/dashboard", label: "لوحة التحكم" },
  { href: "/batches", label: "الدُفعات" },
  { href: "/unavailable", label: "غير المتوفرة" },
  { href: "/account", label: "حسابي" },
];

const adminNav: NavigationItem[] = [
  { href: "/stats", label: "Stats" },
  { href: "/pharmacies", label: "الصيدليات" },
  { href: "/users", label: "المستخدمون" },
  { href: "/assignments", label: "التعيينات" },
  { href: "/settings", label: "الإعدادات" },
];

export function navigationForRole(role: Role): NavigationItem[] {
  if (role === "pharmacist") return pharmacistNav;
  if (role === "sales_rep") return salesRepNav;
  return [...baseNav, ...adminNav];
}

export function isRouteAllowedForRole(path: string, role: string | null): boolean {
  if (role === "pharmacist") {
    return (
      path === "/dashboard" ||
      path === "/requests" ||
      path.startsWith("/requests/") ||
      path === "/account"
    );
  }

  if (role === "sales_rep") {
    return (
      path === "/dashboard" ||
      path === "/batches" ||
      path.startsWith("/batches/") ||
      path === "/unavailable" ||
      path === "/account"
    );
  }

  return true;
}

export function swipeDestination(
  pathname: string,
  hrefs: string[],
  deltaX: number,
): string | null {
  const currentIndex = hrefs.findIndex(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
  if (currentIndex < 0 || deltaX === 0) return null;

  // Physical direction: swipe left advances through the visible menu, while
  // swipe right returns to the preceding view.
  const targetIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
  return hrefs[targetIndex] ?? null;
}
