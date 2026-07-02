import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRouteAllowedForRole } from "@/lib/navigation";

// Refresh the auth session on every request and guard routes:
// unauthenticated -> /login; authenticated on /login -> /dashboard.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Session JWTs use ES256, so getClaims() verifies identity locally against the
  // cached JWKS. Unlike getUser(), this avoids an Auth-server round trip on every
  // navigation while still refreshing expired sessions through the SSR client.
  const { data, error } = await supabase.auth.getClaims();
  const userId = error ? null : data?.claims?.sub;
  const userRole = error ? null : data?.claims?.user_role;

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  const isPublicAuthRoute =
    isLogin || path === "/forgot-password" || path === "/auth/callback";

  if (!userId && !isPublicAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (userId && isLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (
    userId &&
    !isPublicAuthRoute &&
    !isRouteAllowedForRole(path, typeof userRole === "string" ? userRole : null)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
