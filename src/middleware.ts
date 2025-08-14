import { NextRequest, NextResponse } from "next/server";

export async function middleware() {
  // Middleware runs in Edge Runtime
  // Timer initialization has been moved to /api/init-timers
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico (favicon file)
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
