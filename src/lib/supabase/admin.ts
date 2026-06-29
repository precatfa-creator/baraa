import { createClient } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. SERVER-ONLY. Use exclusively inside server
// actions that have already verified the caller is an admin (see requireAdmin).
// Never import this into a client component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
