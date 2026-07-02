import * as XLSX from "xlsx";
import { getAdminProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { auditEventLabel, entityLabel } from "@/lib/audit-labels";

type ExportRow = {
  id: number;
  created_at: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
};

export async function GET(request: Request) {
  if (!(await getAdminProfile())) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const date = (key: string, end = false) => {
    const value = url.searchParams.get(key);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`
      : null;
  };
  const value = (key: string) => {
    const result = url.searchParams.get(key);
    return result && result !== "all" ? result : null;
  };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_audit_report", {
    p_search: value("q"),
    p_event_type: value("type"),
    p_actor_id: value("actor"),
    p_from: date("from"),
    p_to: date("to", true),
    p_limit: 10000,
    p_offset: 0,
  });
  if (error) return new Response("Export failed", { status: 500 });

  const rows = (data ?? []) as ExportRow[];
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      "التاريخ والوقت": new Date(row.created_at).toLocaleString("ar-LY-u-nu-latn"),
      "العملية": auditEventLabel(row.event_type),
      "نوع السجل": entityLabel(row.entity_type),
      "معرف السجل": row.entity_id ?? "",
      "المستخدم": row.actor_name ?? "النظام",
      "الدور": row.actor_role ?? "",
      "عنوان IP": row.ip_address ?? "",
      "الجهاز والمتصفح": row.user_agent ?? "",
      "كل التفاصيل": JSON.stringify(row.details),
    })),
  );
  sheet["!cols"] = [
    { wch: 24 }, { wch: 28 }, { wch: 20 }, { wch: 38 },
    { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 45 }, { wch: 100 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "سجل النظام");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `audit-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
