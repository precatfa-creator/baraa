"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck } from "lucide-react";
import { closeBatch } from "@/actions/batches";
import { Button } from "@/components/ui/button";

export function CloseBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("سيتم تحديد الأصناف غير المشتراة كـ«غير متوفر» وإغلاق الدفعة. متابعة؟")) return;
        start(async () => {
          const r = await closeBatch(batchId);
          if (!r.ok) {
            toast.error(r.error);
          } else {
            toast.success("تم إغلاق الدفعة.");
            router.refresh();
          }
        });
      }}
    >
      <CheckCheck className="size-4" />
      إغلاق الدفعة
    </Button>
  );
}
