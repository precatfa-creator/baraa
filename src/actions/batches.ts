"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Same errcode → Arabic mapping as actions/requests.ts (kept local; tiny).
function rpcError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "42501":
      return "ليس لديك صلاحية لهذا الإجراء.";
    case "55000":
      return "تغيّرت حالة الدفعة من مستخدم آخر. حدّث الصفحة وحاول مجددًا.";
    case "22023":
      return "هذا الإجراء غير مسموح به.";
    case "P0002":
      return "العنصر غير موجود.";
    default:
      console.error("batch rpc failed:", error.code, error.message);
      return "تعذر تنفيذ الإجراء. حاول مرة أخرى.";
  }
}

const uuid = z.string().uuid();

export async function takeBatch(batchId: string): Promise<ActionResult> {
  if (!uuid.safeParse(batchId).success) return { ok: false, error: "دفعة غير صالحة." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_batch", { p_batch_id: batchId });
  if (error) return { ok: false, error: rpcError(error) };
  revalidatePath(`/batches/${batchId}`);
  revalidatePath("/batches");
  return { ok: true };
}

export async function setItemPurchased(
  requestId: string,
  purchased: boolean,
): Promise<ActionResult> {
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "عنصر غير صالح." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_batch_item_purchased", {
    p_request_id: requestId,
    p_purchased: purchased,
  });
  if (error) return { ok: false, error: rpcError(error) };
  revalidatePath("/batches", "layout");
  return { ok: true };
}

export async function splitBatch(
  batchId: string,
  requestIds: string[],
): Promise<{ ok: true; newBatchId: string } | { ok: false; error: string }> {
  if (!uuid.safeParse(batchId).success) return { ok: false, error: "دفعة غير صالحة." };
  if (!z.array(uuid).min(1).safeParse(requestIds).success) {
    return { ok: false, error: "اختر صنفًا واحدًا على الأقل." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("split_batch", {
    p_batch_id: batchId,
    p_request_ids: requestIds,
  });
  if (error) return { ok: false, error: rpcError(error) };
  revalidatePath("/batches", "layout");
  return { ok: true, newBatchId: data as string };
}
