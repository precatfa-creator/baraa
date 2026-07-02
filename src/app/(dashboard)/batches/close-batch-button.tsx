"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { closeBatch } from "@/actions/batches";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function CloseBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="outline">
          <CheckCheck className="size-4" />
          إغلاق الدفعة
        </Button>
      }
      title="إغلاق الدفعة"
      description="سيتم تحديد الأصناف غير المشتراة كـ«غير متوفر» وإغلاق الدفعة. متابعة؟"
      confirmLabel="إغلاق"
      onConfirm={async () => {
        const r = await closeBatch(batchId);
        if (!r.ok) {
          toast.error(r.error);
        } else {
          toast.success("تم إغلاق الدفعة.");
          router.refresh();
        }
      }}
    />
  );
}
