import type { Role } from "@/lib/auth";

export type Status = "missing" | "in_purchase" | "fulfilled" | "cancelled";

// Arabic UI labels for the English DB statuses (PRD §5).
export const statusLabel: Record<Status, string> = {
  missing: "ناقص",
  in_purchase: "قيد الشراء",
  fulfilled: "تم توفيره",
  cancelled: "ملغي",
};

export const statusBadgeClass: Record<Status, string> = {
  missing: "bg-amber-100 text-amber-800",
  in_purchase: "bg-blue-100 text-blue-800",
  fulfilled: "bg-green-100 text-green-800",
  cancelled: "bg-zinc-100 text-zinc-600",
};

export type BatchStatus = "open" | "in_market" | "closed";

export const batchStatusLabel: Record<BatchStatus, string> = {
  open: "قيد التجميع",
  in_market: "في السوق",
  closed: "مكتملة",
};

export const batchStatusBadgeClass: Record<BatchStatus, string> = {
  open: "bg-amber-100 text-amber-800",
  in_market: "bg-blue-100 text-blue-800",
  closed: "bg-green-100 text-green-800",
};

export const priorityLabel: Record<string, string> = {
  low: "منخفضة",
  normal: "عادية",
  high: "عالية",
  urgent: "عاجلة",
};

export type Transition = { to: Status; label: string; needsNote?: boolean };

// Buttons to offer for a request, given the viewer's role and the current status.
// Mirrors docs/PERMISSIONS.md §5; transition_shortage_status() is the real gate.
// Visibility is already RLS-scoped (pharmacist=own pharmacy, rep=assigned), so we
// only branch on role + status here, not on ownership.
export function availableTransitions(role: Role, status: Status): Transition[] {
  const startAndCancel: Transition[] = [
    { to: "in_purchase", label: "بدء الشراء" },
    { to: "cancelled", label: "إلغاء" },
  ];
  const fulfillAndCancel: Transition[] = [
    { to: "fulfilled", label: "تم التوفير" },
    { to: "cancelled", label: "إلغاء" },
  ];

  if (role === "company_admin" || role === "super_admin") {
    if (status === "missing") return startAndCancel;
    if (status === "in_purchase") return fulfillAndCancel;
    if (status === "fulfilled") return [{ to: "missing", label: "إعادة فتح", needsNote: true }];
    return [];
  }
  if (role === "sales_rep") {
    if (status === "missing") return startAndCancel;
    if (status === "in_purchase") return fulfillAndCancel;
    return [];
  }
  if (role === "pharmacist") {
    if (status === "missing") return [{ to: "cancelled", label: "إلغاء" }];
    return [];
  }
  return [];
}
