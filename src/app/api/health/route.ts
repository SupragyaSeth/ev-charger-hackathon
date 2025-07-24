import { NextResponse } from "next/server";
import { authPrisma, queuePrisma } from "@/lib/prisma";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";

/**
 * GET /api/health
 * Health check endpoint for the EV charger system
 */
export const GET = withErrorHandler(async () => {
  // Test database connections
  const authCount = await authPrisma.user.count();
  const queueCount = await queuePrisma.queue.count();

  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    databases: {
      auth: {
        connected: true,
        userCount: authCount,
      },
      queue: {
        connected: true,
        queueCount: queueCount,
      },
    },
    environment: process.env.NODE_ENV,
  };

  return createSuccessResponse(healthData, "System is healthy");
});
