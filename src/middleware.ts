import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const { url, publicKey } = getSupabaseEnv();
  if (!url || !publicKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    url,
    publicKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdminLogin = path === "/admin/login" || path.startsWith("/admin/login/");
  const isAdminArea = path.startsWith("/admin");

  if (!isAdminArea) {
    return supabaseResponse;
  }

  if (isAdminLogin) {
    if (user) {
      const { data: adminRow } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (adminRow) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
    return supabaseResponse;
  }

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
