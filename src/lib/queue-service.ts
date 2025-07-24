import { queuePrisma, authPrisma } from "./prisma";
import { QueueEntry } from "@/types";
import { TimerService } from "./timer-service";

export class QueueService {
  /**
   * Add a user to the queue for a specific charger
   */
  static async addToQueue(
    userId: number,
    chargerId: number
  ): Promise<QueueEntry> {
    // Validate user exists
    const user = await authPrisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User does not exist");
    }

    // Validate charger ID
    const validChargerIds = [1, 2, 3, 4, 5, 6, 7, 8];
    if (!validChargerIds.includes(chargerId)) {
      throw new Error("Invalid chargerId. Must be 1-8.");
    }

    // Check if user is already in queue or charging
    const existingEntry = await queuePrisma.queue.findFirst({
      where: {
        userId,
        status: { in: ["waiting", "charging"] },
      },
    });

    if (existingEntry) {
      throw new Error(
        `User is already ${
          existingEntry.status === "charging" ? "charging" : "in queue"
        }`
      );
    }

    // Find next position in queue for this charger
    const lastInQueue = await queuePrisma.queue.findFirst({
      where: { chargerId, status: "waiting" },
      orderBy: { position: "desc" },
    });

    const nextPosition = lastInQueue ? lastInQueue.position + 1 : 1;

    // Create new queue entry
    const newEntry = await queuePrisma.queue.create({
      data: {
        userId,
        chargerId,
        position: nextPosition,
        status: "waiting",
      },
    });

    return newEntry as QueueEntry;
  }

  /**
   * Start charging for the first user in queue
   */
  static async startCharging(
    userId: number,
    chargerId: number,
    durationMinutes: number
  ): Promise<QueueEntry> {
    // Find the first waiting user in queue for this charger
    const queueEntry = await queuePrisma.queue.findFirst({
      where: { chargerId, status: "waiting" },
      orderBy: { position: "asc" },
    });

    if (!queueEntry || queueEntry.userId !== userId) {
      throw new Error("User is not first in queue or not found");
    }

    // Update status to charging
    const updated = await queuePrisma.queue.update({
      where: { id: queueEntry.id },
      data: {
        status: "charging",
        durationMinutes,
      },
    });

    // Start the server-side timer
    await TimerService.startChargingTimer(queueEntry.id, durationMinutes);

    // Remove any other waiting entries for this user
    await queuePrisma.queue.deleteMany({
      where: {
        userId,
        status: "waiting",
        id: { not: queueEntry.id },
      },
    });

    return updated as QueueEntry;
  }

  /**
   * Complete charging and remove from queue
   */
  static async completeCharging(
    userId: number,
    chargerId: number
  ): Promise<void> {
    const chargingEntry = await queuePrisma.queue.findFirst({
      where: {
        userId,
        chargerId,
        status: { in: ["charging", "overtime"] },
      },
    });

    if (!chargingEntry) {
      throw new Error("No active charging session found");
    }

    // Clear the timer and remove from queue
    await TimerService.completeCharging(chargingEntry.id);

    // Update positions for remaining users in queue
    await this.reorderQueue(chargerId);
  }

  /**
   * Get current queue for all chargers
   */
  static async getQueue(): Promise<QueueEntry[]> {
    const result = await queuePrisma.queue.findMany({
      orderBy: [{ chargerId: "asc" }, { position: "asc" }],
    });
    return result as QueueEntry[];
  }

  /**
   * Get queue for a specific charger
   */
  static async getQueueForCharger(chargerId: number): Promise<QueueEntry[]> {
    const result = await queuePrisma.queue.findMany({
      where: { chargerId },
      orderBy: { position: "asc" },
    });
    return result as QueueEntry[];
  }

  /**
   * Remove user from queue
   */
  static async removeFromQueue(userId: number): Promise<void> {
    const entries = await queuePrisma.queue.findMany({
      where: { userId, status: "waiting" },
    });

    if (entries.length === 0) {
      throw new Error("User not found in queue");
    }

    // Remove user entries
    await queuePrisma.queue.deleteMany({
      where: { userId, status: "waiting" },
    });

    // Reorder queues for affected chargers
    const chargerIds = [...new Set(entries.map((e: any) => e.chargerId))];
    for (const chargerId of chargerIds) {
      await this.reorderQueue(Number(chargerId));
    }
  }

  /**
   * Get remaining time for a charging session
   */
  static async getRemainingTime(queueEntryId: number): Promise<number> {
    return await TimerService.getRemainingTime(queueEntryId);
  }

  /**
   * Find the best available charger for a new user
   * Priority: 1) Available chargers, 2) Chargers with shortest queue
   */
  static async findBestCharger(): Promise<number> {
    const MAX_CHARGERS = 8;
    const chargerStats = [];

    // Get stats for each charger
    for (let chargerId = 1; chargerId <= MAX_CHARGERS; chargerId++) {
      const chargingCount = await queuePrisma.queue.count({
        where: { chargerId, status: { in: ["charging", "overtime"] } },
      });
      
      const waitingCount = await queuePrisma.queue.count({
        where: { chargerId, status: "waiting" },
      });

      chargerStats.push({
        chargerId,
        isAvailable: chargingCount === 0,
        totalQueue: chargingCount + waitingCount,
        waitingCount,
      });
    }

    // Sort by availability first, then by shortest queue
    chargerStats.sort((a, b) => {
      // Available chargers first
      if (a.isAvailable && !b.isAvailable) return -1;
      if (!a.isAvailable && b.isAvailable) return 1;
      
      // Then by shortest total queue
      if (a.totalQueue !== b.totalQueue) return a.totalQueue - b.totalQueue;
      
      // Finally by charger ID as tiebreaker
      return a.chargerId - b.chargerId;
    });

    return chargerStats[0].chargerId;
  }

  /**
   * Reorder queue positions after removal
   */
  private static async reorderQueue(chargerId: number): Promise<void> {
    const waitingEntries = await queuePrisma.queue.findMany({
      where: { chargerId, status: "waiting" },
      orderBy: { position: "asc" },
    });

    // Update positions to be sequential
    for (let i = 0; i < waitingEntries.length; i++) {
      await queuePrisma.queue.update({
        where: { id: waitingEntries[i].id },
        data: { position: i + 1 },
      });
    }
  }
}
