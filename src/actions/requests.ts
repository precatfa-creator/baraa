"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Map the errcodes raised by the workflow functions to friendly Arabic messages.
function rpcError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "42501":
      return "ليس لديك صلاحية لهذا الإجراء.";
    case "55000":
      return "تم تحديث الطلب من مستخدم آخر. حدّث الصفحة وحاول مجددًا.";
    case "22023":
      return "هذا الإجراء غير مسموح به.";
    case "P0002":
      return "العنصر غير موجود.";
    default:
      console.error("request rpc failed:", error.code, error.message);
      return "تعذر تنفيذ الإجراء. حاول مرة أخرى.";
  }
}

const createSchema = z.object({
  item_id: z.string().uuid("اختر صنفًا."),
  quantity: z.coerce.number().positive("الكمية يجب أن تكون أكبر من صفر."),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function createShortageRequest(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = createSchema.safeParse({
    item_id: formData.get("item_id") ?? "",
    quantity: formData.get("quantity") ?? "1",
    priority: formData.get("priority") ?? "normal",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  // Pharmacy comes from the trusted profile, not the form.
  const profile = await getCurrentProfile();
  if (!profile?.pharmacy_id) {
    return { ok: false, error: "حسابك غير مرتبط بصيدلية." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_shortage_request", {
    p_pharmacy_id: profile.pharmacy_id,
    p_item_id: parsed.data.item_id,
    p_quantity: parsed.data.quantity,
    p_priority: parsed.data.priority,
    p_notes: parsed.data.notes,
  });
  if (error) return { ok: false, error: rpcError(error) };

  revalidatePath("/requests");
  return { ok: true };
}

const transitionSchema = z.object({
  request_id: z.string().uuid(),
  expected_status: z.enum(["missing", "in_purchase", "fulfilled", "cancelled"]),
  new_status: z.enum(["missing", "in_purchase", "fulfilled", "cancelled"]),
  note: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function transitionStatus(input: {
  request_id: string;
  expected_status: string;
  new_status: string;
  note?: string | null;
}): Promise<ActionResult> {
  const parsed = transitionSchema.safeParse({ note: null, ...input });
  if (!parsed.success) {
    return { ok: false, error: "طلب غير صالح." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_shortage_status", {
    p_request_id: parsed.data.request_id,
    p_expected_status: parsed.data.expected_status,
    p_new_status: parsed.data.new_status,
    p_note: parsed.data.note,
  });
  if (error) return { ok: false, error: rpcError(error) };

  revalidatePath("/requests");
  return { ok: true };
}
