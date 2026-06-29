"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Activate/deactivate button. `action` is a server action (id, isActive) -> void.
export function ActiveToggle({
  id,
  active,
  action,
}: {
  id: string;
  active: boolean;
  action: (id: string, isActive: boolean) => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await action(id, !active);
          router.refresh();
        })
      }
    >
      {active ? "إيقاف" : "تفعيل"}
    </Button>
  );
}
