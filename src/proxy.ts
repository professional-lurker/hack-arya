/**
 * Next.js 16 Proxy (formerly middleware)
 * Must NOT import any native modules (better-sqlite3, bcrypt, etc.)
 * Runs in Edge Runtime — only cookie/header inspection allowed.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Pass-through: API gateway uses its own key-based auth
  if (pathname.startsWith("/api/v1/chat") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/v1/health") ||
      pathname === "/") {
    return NextResponse.next();
  }

  // Auth pages — always accessible
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return NextResponse.next();
  }

  // Protected dashboard routes — check for NextAuth session cookie
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
