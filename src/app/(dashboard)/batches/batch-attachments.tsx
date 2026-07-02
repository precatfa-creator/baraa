"use client";

import { useRef, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileText, ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteBatchAttachment,
  finalizeBatchAttachment,
  prepareBatchAttachment,
} from "@/actions/batches";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export type BatchAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

const MAX_SIZE = 10 * 1024 * 1024;

export function BatchAttachments({
  batchId,
  attachments,
  canManage,
}: {
  batchId: string;
  attachments: BatchAttachment[];
  canManage: boolean;
}) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function selected(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    start(async () => {
      const supabase = createClient();
      let uploaded = 0;
      for (const file of files) {
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name}: يتجاوز 10 ميجابايت.`);
          continue;
        }
        const prepared = await prepareBatchAttachment(batchId, {
          name: file.name,
          type: file.type,
          size: file.size,
        });
        if (!prepared.ok) {
          toast.error(`${file.name}: ${prepared.error}`);
          continue;
        }
        const { error: uploadError } = await supabase.storage
          .from("batch-attachments")
          .uploadToSignedUrl(prepared.path, prepared.token, file, {
            contentType: file.type,
          });
        if (uploadError) {
          toast.error(`${file.name}: تعذر الرفع.`);
          continue;
        }
        const finalized = await finalizeBatchAttachment(batchId, {
          path: prepared.path,
          name: file.name,
          type: file.type,
          size: file.size,
        });
        if (!finalized.ok) {
          toast.error(`${file.name}: ${finalized.error}`);
          continue;
        }
        uploaded++;
      }
      if (uploaded) {
        toast.success(`تم إرفاق ${uploaded} ملف.`);
        router.refresh();
      }
    });
  }

  return (
    <section className="glass-panel space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">مرفقات الدفعة</h2>
          <p className="text-xs text-muted-foreground">صور أو PDF أو Word أو Excel، حتى 10 MB.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={selected}
            />
            <input
              ref={filesRef}
              type="file"
              accept="image/*,.pdf,.csv,.xls,.xlsx,.doc,.docx"
              multiple
              className="hidden"
              onChange={selected}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="size-4" />
              الكاميرا
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => filesRef.current?.click()}
            >
              <Paperclip className="size-4" />
              الاستوديو أو ملف
            </Button>
          </div>
        )}
      </div>

      {attachments.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attachments.map((attachment) => {
            const image = attachment.mimeType.startsWith("image/");
            return (
              <div key={attachment.id} className="flex items-center gap-2 rounded-lg border p-2">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
                  style={
                    image
                      ? {
                          backgroundImage: `url("${attachment.url}")`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }
                      : undefined
                  }
                >
                  {!image && <FileText className="size-5 text-muted-foreground" />}
                  {image && <ImageIcon className="sr-only" />}
                </a>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 hover:underline"
                >
                  <div className="truncate text-sm font-medium">{attachment.fileName}</div>
                  <div className="text-xs text-muted-foreground">
                    {(attachment.size / 1024).toFixed(0)} KB
                  </div>
                </a>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={pending}
                    aria-label={`حذف ${attachment.fileName}`}
                    onClick={() =>
                      start(async () => {
                        const result = await deleteBatchAttachment(attachment.id);
                        if (!result.ok) toast.error(result.error);
                        else {
                          toast.success("تم حذف المرفق.");
                          router.refresh();
                        }
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          لا توجد مرفقات بعد.
        </p>
      )}
    </section>
  );
}
