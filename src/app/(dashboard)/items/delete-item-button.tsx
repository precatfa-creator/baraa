"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteItem } from "@/actions/items";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

export function DeleteItemButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      }
      title="حذف الصنف نهائيًا"
      description={`حذف "${name}" نهائيًا؟ لا يمكن التراجع.`}
      confirmLabel="حذف"
      destructive
      onConfirm={async () => {
        const r = await deleteItem(id);
        if (!r.ok) {
          toast.error(r.error);
        } else {
          toast.success("تم حذف الصنف.");
          router.refresh();
        }
      }}
    />
  );
}
