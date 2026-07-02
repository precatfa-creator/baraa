"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { ResetResult } from "@/actions/admin-reset";

export function DangerButton({
  label,
  description,
  successMsg,
  action,
}: {
  label: string;
  description: string;
  successMsg: string;
  action: () => Promise<ResetResult>;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" className="w-full justify-start sm:w-auto">
          <Trash2 className="size-4" />
          {label}
        </Button>
      }
      title={label}
      description={description}
      confirmLabel="حذف نهائي"
      destructive
      onConfirm={async () => {
        const r = await action();
        if (!r.ok) {
          toast.error(r.error);
        } else {
          toast.success(`${successMsg} (${r.count})`);
          router.refresh();
        }
      }}
    />
  );
}
