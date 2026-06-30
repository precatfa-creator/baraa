"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { takeBatch } from "@/actions/batches";
import { Button } from "@/components/ui/button";

export function TakeBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await takeBatch(batchId);
          if (!r.ok) {
            toast.error(r.error);
          } else {
            toast.success("تم أخذ الدفعة إلى السوق.");
            router.refresh();
          }
        })
      }
    >
      <ShoppingCart className="size-4" />
      أخذ إلى السوق
    </Button>
  );
}
