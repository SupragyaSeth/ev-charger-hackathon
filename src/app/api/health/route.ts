import { SupabaseService } from "@/lib/supabase-service";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-utils";

/**
 * GET /api/health
 * Health check endpoint for the EV charger system
 */
export const GET = withErrorHandler(async () => {
  // Test database connections
  const users = await SupabaseService.getAllUsers();
  const queue = await SupabaseService.findQueueEntries();

  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    databases: {
      supabase: {
        connected: true,
        userCount: users.length,
        queueCount: queue.length,
      },
    },
    environment: process.env.NODE_ENV,
  };

  return createSuccessResponse(healthData, "System is healthy");
});
