import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "super_admin" | "company_admin" | "pharmacist" | "sales_rep";

export type Profile = {
  id: string;
  company_id: string | null;
  pharmacy_id: string | null;
  full_name: string;
  role: Role;
  is_active: boolean;
};

// The signed-in user's profile, or null if unauthenticated. Built entirely from the
// JWT claims injected by public.custom_access_token_hook (user_role, company_id,
// pharmacy_id, is_active, full_name) — getClaims() verifies the token locally, so
// this costs no network round-trip and no profiles query per page. The middleware
// already refreshed/validated the session for this request.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  const role = claims?.user_role as Role | undefined;
  // No role claim means the token predates the hook (or it's disabled) — treat as
  // unauthenticated rather than trusting a half-populated token.
  if (error || !claims?.sub || !role) return null;

  const str = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
  return {
    id: claims.sub as string,
    company_id: str(claims.company_id),
    pharmacy_id: str(claims.pharmacy_id),
    // full_name was added to the hook later; fall back to email until tokens refresh.
    full_name: str(claims.full_name) ?? str(claims.email) ?? "",
    role,
    is_active: Boolean(claims.is_active),
  };
});

export function isAdmin(role: Role | undefined): boolean {
  return role === "company_admin" || role === "super_admin";
}

// Active admin profile, or null. Use to gate admin server actions and pages.
export async function getAdminProfile(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || !isAdmin(profile.role)) return null;
  return profile;
}
