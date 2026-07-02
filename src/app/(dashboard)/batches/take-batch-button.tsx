"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { takeBatch } from "@/actions/batches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TakeBatchButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const result = await takeBatch(batchId, source);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("بدأ الشراء وتم تطبيق الجهة على كل الأصناف.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <ShoppingCart className="size-4" />
        بدء الشراء
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>بدء شراء الدفعة</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="default_purchase_source">الشركة أو جهة الشراء الافتراضية</Label>
          <Input
            id="default_purchase_source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            maxLength={200}
            placeholder="مثال: شركة الدواء أو سوق الجملة"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            ستُطبق على كل الأصناف، ويمكن تعديل جهة أي صنف لاحقًا.
          </p>
        </div>
        <DialogFooter>
          <Button disabled={pending || !source.trim()} onClick={submit}>
            {pending ? "جارٍ البدء…" : "بدء الشراء"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
