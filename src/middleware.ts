import { NextRequest, NextResponse } from "next/server";
import { TimerService } from "@/lib/timer-service";

let timersInitialized = false;

export async function middleware(request: NextRequest) {
  // Initialize timers on first request
  if (!timersInitialized) {
    try {
      await TimerService.initializeExistingTimers();
      timersInitialized = true;
      console.log("Timers initialized successfully");
    } catch (error) {
      console.error("Failed to initialize timers:", error);
    }
  }

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
