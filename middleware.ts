import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

const publicPrefixes = ["/login", "/api/auth/login", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.match(/\.(.*)$/)
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.get(AUTH_COOKIE_NAME)?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/assignments/:path*", "/materials/:path*", "/settings/:path*"]
};
