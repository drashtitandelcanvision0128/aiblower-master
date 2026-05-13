import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/auth/constants";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isAdminLogin = path === "/admin/login" || path.startsWith("/admin/login/");
  const isAdminArea = path.startsWith("/admin");

  if (!isAdminArea) {
    return NextResponse.next();
  }

  const secretRaw = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secretRaw || secretRaw.length < 16) {
    if (isAdminLogin) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secretRaw), { algorithms: ["HS256"] });
      valid = true;
    } catch {
      valid = false;
    }
  }

  if (isAdminLogin) {
    if (valid) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!valid) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
