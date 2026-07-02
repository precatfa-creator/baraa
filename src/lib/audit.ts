import { headers } from "next/headers";

type AuditClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ error: { message: string } | null }>;
};

type AuditInput = {
  eventType: string;
  entityType: string;
  action: string;
  summary: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  companyId?: string | null;
  actorId?: string | null;
};

export async function recordAuditEvent(client: AuditClient, input: AuditInput): Promise<void> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ipAddress = forwarded && /^[0-9a-f:.]+$/i.test(forwarded) ? forwarded : null;
  const { error } = await client.rpc("record_audit_event", {
    p_event_type: input.eventType,
    p_entity_type: input.entityType,
    p_action: input.action,
    p_summary: input.summary,
    p_entity_id: input.entityId ?? null,
    p_details: input.details ?? {},
    p_company_id: input.companyId ?? null,
    p_actor_id: input.actorId ?? null,
    p_ip_address: ipAddress,
    p_user_agent: requestHeaders.get("user-agent"),
  });
  if (error) console.error("recordAuditEvent:", error.message);
}
