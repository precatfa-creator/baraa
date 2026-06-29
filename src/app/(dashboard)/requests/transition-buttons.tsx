"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { transitionStatus } from "@/actions/requests";
import { availableTransitions, type Status } from "@/lib/workflow";
import type { Role } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function TransitionButtons({
  requestId,
  status,
  role,
}: {
  requestId: string;
  status: Status;
  role: Role;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const transitions = availableTransitions(role, status);
  if (transitions.length === 0) return null;

  function run(to: Status, needsNote?: boolean) {
    // Only the admin reopen path requires a reason; prompt for it inline.
    const note = needsNote ? window.prompt("سبب إعادة الفتح:")?.trim() : undefined;
    if (needsNote && !note) return; // cancelled the prompt
    startTransition(async () => {
      const result = await transitionStatus({
        request_id: requestId,
        expected_status: status,
        new_status: to,
        note,
      });
      if (result.ok) {
        toast.success("تم تحديث الحالة.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex gap-2">
      {transitions.map((t) => (
        <Button
          key={t.to}
          size="sm"
          variant={t.to === "cancelled" ? "outline" : "default"}
          disabled={pending}
          onClick={() => run(t.to, t.needsNote)}
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}
