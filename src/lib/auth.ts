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

// The signed-in user's profile, or null if unauthenticated. RLS allows a user to read
// their own row (profiles_select: id = auth.uid()).
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, company_id, pharmacy_id, full_name, role, is_active")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
}

export function isAdmin(role: Role | undefined): boolean {
  return role === "company_admin" || role === "super_admin";
}

// Active admin profile, or null. Use to gate admin server actions and pages.
export async function getAdminProfile(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || !isAdmin(profile.role)) return null;
  return profile;
}
