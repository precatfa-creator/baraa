"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";

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
const purchaseSource = z.string().trim().min(1).max(200);

export async function takeBatch(batchId: string, source: string): Promise<ActionResult> {
  if (!uuid.safeParse(batchId).success) return { ok: false, error: "دفعة غير صالحة." };
  const parsedSource = purchaseSource.safeParse(source);
  if (!parsedSource.success) return { ok: false, error: "أدخل جهة الشراء." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_batch", {
    p_batch_id: batchId,
    p_purchase_source: parsedSource.data,
  });
  if (error) return { ok: false, error: rpcError(error) };
  revalidatePath(`/batches/${batchId}`);
  revalidatePath("/batches");
  return { ok: true };
}

export async function setItemPurchaseSource(
  requestId: string,
  source: string,
): Promise<ActionResult> {
  if (!uuid.safeParse(requestId).success) return { ok: false, error: "عنصر غير صالح." };
  const parsedSource = purchaseSource.safeParse(source);
  if (!parsedSource.success) return { ok: false, error: "أدخل جهة شراء صالحة." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_batch_item_purchase_source", {
    p_request_id: requestId,
    p_purchase_source: parsedSource.data,
  });
  if (error) return { ok: false, error: rpcError(error) };
  revalidatePath("/batches", "layout");
  return { ok: true };
}

export async function closeBatch(batchId: string): Promise<ActionResult> {
  if (!uuid.safeParse(batchId).success) return { ok: false, error: "دفعة غير صالحة." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_batch", { p_batch_id: batchId });
  if (error) return { ok: false, error: rpcError(error) };
  revalidatePath("/batches", "layout");
  revalidatePath("/unavailable");
  return { ok: true };
}

export async function requeueNotFound(requestIds: string[]): Promise<ActionResult> {
  if (!z.array(uuid).min(1).safeParse(requestIds).success) {
    return { ok: false, error: "اختر صنفًا واحدًا على الأقل." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("requeue_not_found", { p_request_ids: requestIds });
  if (error) return { ok: false, error: rpcError(error) };
  revalidatePath("/unavailable");
  revalidatePath("/batches", "layout");
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

const BUCKET = "batch-attachments";
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

type AttachmentInput = { name: string; type: string; size: number };
type PreparedUpload =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

async function getManageableBatch(batchId: string) {
  const profile = await getCurrentProfile();
  if (
    !profile?.company_id ||
    !["sales_rep", "company_admin", "super_admin"].includes(profile.role)
  ) {
    return null;
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("batches")
    .select("id, company_id")
    .eq("id", batchId)
    .maybeSingle();
  return data?.company_id === profile.company_id || profile.role === "super_admin"
    ? { batch: data, profile, supabase }
    : null;
}

export async function prepareBatchAttachment(
  batchId: string,
  file: AttachmentInput,
): Promise<PreparedUpload> {
  if (!uuid.safeParse(batchId).success) return { ok: false, error: "دفعة غير صالحة." };
  if (
    !file.name.trim() ||
    file.size <= 0 ||
    file.size > MAX_ATTACHMENT_SIZE ||
    !ALLOWED_MIME_TYPES.has(file.type)
  ) {
    return { ok: false, error: "الملف غير مدعوم أو يتجاوز 10 ميجابايت." };
  }
  const access = await getManageableBatch(batchId);
  if (!access?.batch) return { ok: false, error: "ليس لديك صلاحية لإرفاق الملفات." };

  const { count } = await access.supabase
    .from("batch_attachments")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  if ((count ?? 0) >= 20) return { ok: false, error: "الحد الأقصى 20 مرفقًا للدفعة." };

  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
  const path = `${access.batch.company_id}/${batchId}/${crypto.randomUUID()}${
    extension ? `.${extension}` : ""
  }`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error || !data) {
    console.error("prepareBatchAttachment:", error?.message);
    return { ok: false, error: "تعذر تجهيز رفع الملف." };
  }
  return { ok: true, path: data.path, token: data.token };
}

export async function finalizeBatchAttachment(
  batchId: string,
  file: AttachmentInput & { path: string },
): Promise<ActionResult> {
  const access = await getManageableBatch(batchId);
  if (!access?.batch) return { ok: false, error: "ليس لديك صلاحية لإرفاق الملفات." };
  const expectedPrefix = `${access.batch.company_id}/${batchId}/`;
  if (
    !file.path.startsWith(expectedPrefix) ||
    !ALLOWED_MIME_TYPES.has(file.type) ||
    file.size <= 0 ||
    file.size > MAX_ATTACHMENT_SIZE
  ) {
    return { ok: false, error: "بيانات الملف غير صالحة." };
  }

  const { error } = await access.supabase.from("batch_attachments").insert({
    batch_id: batchId,
    company_id: access.batch.company_id,
    uploaded_by: access.profile.id,
    storage_path: file.path,
    file_name: file.name.trim().slice(0, 255),
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (error) {
    await createAdminClient().storage.from(BUCKET).remove([file.path]);
    console.error("finalizeBatchAttachment:", error.code, error.message);
    return { ok: false, error: "تعذر تسجيل المرفق." };
  }
  revalidatePath(`/batches/${batchId}`);
  return { ok: true };
}

export async function deleteBatchAttachment(id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return { ok: false, error: "مرفق غير صالح." };
  const profile = await getCurrentProfile();
  if (!profile || !["sales_rep", "company_admin", "super_admin"].includes(profile.role)) {
    return { ok: false, error: "ليس لديك صلاحية." };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("batch_attachments")
    .select("id, batch_id, storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false, error: "المرفق غير موجود." };

  const { error: deleteError } = await supabase
    .from("batch_attachments")
    .delete()
    .eq("id", id);
  if (deleteError) return { ok: false, error: "ليس لديك صلاحية لحذف المرفق." };
  const { error: storageError } = await createAdminClient().storage
    .from(BUCKET)
    .remove([data.storage_path]);
  if (storageError) console.error("deleteBatchAttachment storage:", storageError.message);
  revalidatePath(`/batches/${data.batch_id}`);
  return { ok: true };
}
