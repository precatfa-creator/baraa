import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Supabase client (server components, actions, route handlers).
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Throws in Server Components (read-only cookies); middleware refreshes the
          // session there, so it's safe to ignore.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ignore — handled by middleware
          }
        },
      },
    },
  );
}
