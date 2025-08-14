import { QueueService } from "@/lib/queue-service";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";

/**
 * PATCH /api/auth/queue
 * Body: { userId: number, chargerId: number, durationMinutes: number }
 * Marks the first user in the queue for a charger as 'charging'
 */
export const PATCH = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const { userId, chargerId, durationMinutes } = body;

  if (!userId || !chargerId || !durationMinutes) {
    return createErrorResponse(
      "Missing userId, chargerId, or durationMinutes",
      400
    );
  }

  const updated = await QueueService.startCharging(
    Number(userId),
    Number(chargerId),
    Number(durationMinutes)
  );

  return createSuccessResponse(updated, "Started charging successfully");
});

/**
 * GET /api/auth/queue
 * Query params: ?action=best-charger to get the best available charger
 * Returns the current queue with all entries or best charger ID
 */
export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "best-charger") {
    const bestChargerId = await QueueService.findBestCharger();
    return createSuccessResponse({ chargerId: bestChargerId });
  }

  const queue = await QueueService.getQueue();
  return createSuccessResponse({ queue });
});

/**
 * POST /api/auth/queue
 * Body: { userId: number, chargerId: number }
 * Adds user to queue for a specific charger
 */
export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const { userId, chargerId } = body;

  console.log("[QUEUE DEBUG] Incoming POST /api/auth/queue", {
    userId,
    chargerId,
    typeUserId: typeof userId,
  });

  if (!userId || !chargerId) {
    return createErrorResponse("Missing userId or chargerId", 400);
  }

  try {
    const newEntry = await QueueService.addToQueue(
      Number(userId),
      Number(chargerId)
    );

    return createSuccessResponse(newEntry, "Added to queue successfully", 201);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to add to queue";

    // If user is already in queue, return success with existing entry
    if (errorMessage.includes("already")) {
      return createSuccessResponse(null, errorMessage, 200);
    }

    return createErrorResponse(errorMessage, 400);
  }
});

/**
 * DELETE /api/auth/queue
 * Body: { userId: number }
 * Removes user from queue
 */
export const DELETE = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const { userId } = body;

  if (!userId) {
    return createErrorResponse("Missing userId", 400);
  }

  await QueueService.removeFromQueue(Number(userId));
  return createSuccessResponse(null, "Removed from queue successfully");
});

/**
 * PUT /api/auth/queue
 * Body: { userId: number, action: "moveBackOneSpot" }
 * Moves user back one spot in their queue
 */
export const PUT = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const { userId, action } = body;

  if (!userId) {
    return createErrorResponse("Missing userId", 400);
  }

  if (action === "moveBackOneSpot") {
    await QueueService.moveBackOneSpot(Number(userId));
    return createSuccessResponse(null, "Moved back one spot successfully");
  }

  return createErrorResponse("Invalid action", 400);
});
