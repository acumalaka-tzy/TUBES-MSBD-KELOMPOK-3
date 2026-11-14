import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAuthToken } from "@/lib/auth/jwt";
import { AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { evaluatePathAccess, getDefaultRedirectForRole } from "@/lib/auth/rbac";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Verifikasi sesi JWT
  const session = token ? await verifyAuthToken(token) : null;
  const userRole = session?.role ?? null;

  // 1. Evaluasi proteksi halaman /admin/* dan /cashier/*
  const access = evaluatePathAccess(pathname, userRole);
  if (!access.allowed && access.redirectUrl) {
    const redirectUrl = new URL(access.redirectUrl, request.url);
    if (!userRole && !redirectUrl.searchParams.has("redirect")) {
      redirectUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Jika sudah login dan mencoba mengakses /login atau /register -> redirect ke area masing-masing
  if (session && (pathname === "/login" || pathname === "/register")) {
    const targetUrl = new URL(getDefaultRedirectForRole(session.role), request.url);
    return NextResponse.redirect(targetUrl);
  }

  return NextResponse.next();
}

// Konfigurasi Matcher: hanya jalankan proxy pada rute aplikasi yang relevan
export const config = {
  matcher: [
    "/admin/:path*",
    "/cashier/:path*",
    "/login",
    "/register",
  ],
};

