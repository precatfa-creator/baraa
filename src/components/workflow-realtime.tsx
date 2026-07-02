"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const WORKFLOW_TABLES = [
  "shortage_requests",
  "shortage_request_requesters",
  "batches",
  "batch_attachments",
  "purchase_events",
] as const;

export function WorkflowRealtime({ companyId }: { companyId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!companyId) return;

    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(refreshTimer);
      // One shortage RPC can emit batch, request, and requester events together.
      // Coalesce that burst into one server-component refresh.
      refreshTimer = setTimeout(() => {
        startTransition(() => router.refresh());
      }, 250);
    };

    const channel = supabase.channel(`workflow:${companyId}`);
    for (const table of WORKFLOW_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `company_id=eq.${companyId}`,
        },
        refresh,
      );
    }
    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.error("Workflow realtime subscription failed");
      }
    });

    return () => {
      clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [companyId, router]);

  return null;
}
