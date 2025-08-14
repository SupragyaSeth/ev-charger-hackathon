import { QueueService } from "@/lib/queue-service";
import { SupabaseService } from "@/lib/supabase-service";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";
import { QueueEntry } from "@/types";

/**
 * GET /api/admin/status
 * Get detailed system status for debugging
 */
export const GET = withErrorHandler(async () => {
  const queue = await QueueService.getQueue();
  const users = await SupabaseService.getAllUsers();

  // Group queue by charger
  const queueByCharger: Record<number, QueueEntry[]> = {};
  for (let i = 1; i <= 8; i++) {
    queueByCharger[i] = queue.filter((entry) => entry.chargerId === i);
  }

  const stats = {
    totalUsers: users.length,
    totalQueueEntries: queue.length,
    waitingUsers: queue.filter((entry) => entry.status === "waiting").length,
    chargingUsers: queue.filter((entry) => entry.status === "charging").length,
    chargerStatus: Object.keys(queueByCharger).map((id) => ({
      chargerId: Number(id),
      waiting: queueByCharger[Number(id)].filter((e) => e.status === "waiting")
        .length,
      charging: queueByCharger[Number(id)].filter(
        (e) => e.status === "charging"
      ).length,
    })),
  };

  return createSuccessResponse({
    stats,
    queue,
    users,
    queueByCharger,
  });
});

/**
 * POST /api/admin/status
 * Admin actions (clear queue, reset positions, etc.)
 */
export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "clear_queue":
      // Clear all queue entries
      await SupabaseService.clearAllQueue();
      return createSuccessResponse(null, "Queue cleared successfully");

    case "clear_waiting":
      // Clear only waiting entries (keep charging)
      await SupabaseService.deleteQueueEntries({
        status: "waiting",
      });
      return createSuccessResponse(null, "Waiting queue cleared successfully");

    case "clear_all_including_charging":
      // Clear ALL entries including those currently charging
      await SupabaseService.clearAllQueue();
      return createSuccessResponse(
        null,
        "All queue entries cleared successfully"
      );

    case "reset_positions":
      // Reset positions for all chargers
      for (let chargerId = 1; chargerId <= 8; chargerId++) {
        const entries = await QueueService.getQueueForCharger(chargerId);
        const waitingEntries = entries.filter((e) => e.status === "waiting");

        for (let i = 0; i < waitingEntries.length; i++) {
          await SupabaseService.updateQueueEntry(waitingEntries[i].id, {
            position: i + 1,
          });
        }
      }
      return createSuccessResponse(null, "Positions reset successfully");

    default:
      return createErrorResponse("Invalid action", 400);
  }
});
