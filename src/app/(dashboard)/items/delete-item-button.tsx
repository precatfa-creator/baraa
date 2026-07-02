"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteItem } from "@/actions/items";
import { Button } from "@/components/ui/button";

export function DeleteItemButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`حذف "${name}" نهائيًا؟ لا يمكن التراجع.`)) return;
        start(async () => {
          const r = await deleteItem(id);
          if (!r.ok) {
            toast.error(r.error);
          } else {
            toast.success("تم حذف الصنف.");
            router.refresh();
          }
        });
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
