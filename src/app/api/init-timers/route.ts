import { TimerService } from "@/lib/timer-service";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";

let timersInitialized = false;

/**
 * GET /api/init-timers
 * Initialize existing timers on server startup
 */
export const GET = withErrorHandler(async () => {
  if (timersInitialized) {
    return createSuccessResponse({ message: "Timers already initialized" });
  }

  try {
    await TimerService.initializeExistingTimers();
    timersInitialized = true;
    console.log("Timers initialized successfully via API");
    return createSuccessResponse({
      message: "Timers initialized successfully",
    });
  } catch (error) {
    console.error("Failed to initialize timers:", error);
    return createErrorResponse("Failed to initialize timers", 500);
  }
});

/**
 * POST /api/init-timers
 * Force re-initialize timers (for development/debugging)
 */
export const POST = withErrorHandler(async () => {
  try {
    await TimerService.initializeExistingTimers();
    timersInitialized = true;
    console.log("Timers re-initialized successfully via API");
    return createSuccessResponse({
      message: "Timers re-initialized successfully",
    });
  } catch (error) {
    console.error("Failed to re-initialize timers:", error);
    return createErrorResponse("Failed to re-initialize timers", 500);
  }
});
