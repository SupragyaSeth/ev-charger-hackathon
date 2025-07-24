import { queuePrisma, authPrisma } from "./prisma";
import { QueueEntry } from "@/types";
import { TimerService } from "./timer-service";
import { EmailService } from "./email-service";

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
    // Check if charger is currently occupied
    const occupiedEntry = await queuePrisma.queue.findFirst({
      where: {
        chargerId,
        status: { in: ["charging", "overtime"] },
      },
    });

    if (occupiedEntry) {
      throw new Error(
        "Charger is currently occupied. Please wait for the current user to finish."
      );
    }

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

    // Calculate charging duration
    const chargingStartTime = chargingEntry.chargingStartedAt
      ? new Date(chargingEntry.chargingStartedAt)
      : new Date();
    const chargingDuration = Math.floor(
      (Date.now() - chargingStartTime.getTime()) / (1000 * 60)
    ); // in minutes

    // Send completion email to the user
    try {
      const userInfo = await this.getUserInfo(userId);
      const chargerName = this.getChargerName(chargerId);

      await EmailService.sendChargingCompleteNotification(
        userInfo.email,
        userInfo.name,
        chargerName,
        chargingDuration
      );
    } catch (error) {
      console.error("Failed to send completion email:", error);
    }

    // Clear the timer and remove from queue
    await TimerService.completeCharging(chargingEntry.id);

    // Update positions for remaining users in queue
    await this.reorderQueue(chargerId);

    // Notify next user in queue that charger is ready
    await this.notifyNextUserInQueue(chargerId);
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

    // Store charger IDs and whether user was first in line for notification
    const chargerIds = [...new Set(entries.map((e: any) => e.chargerId))];
    const wasFirstInLine = entries.some((e: any) => e.position === 1);

    // Remove user entries
    await queuePrisma.queue.deleteMany({
      where: { userId, status: "waiting" },
    });

    // Reorder queues for affected chargers
    for (const chargerId of chargerIds) {
      await this.reorderQueue(Number(chargerId));

      // If user was first in line, notify the new first person
      if (wasFirstInLine) {
        await this.notifyNextUserInQueue(Number(chargerId));
      }
    }
  }

  /**
   * Move user back one spot in their queue (swap with the person behind them)
   */
  static async moveBackOneSpot(userId: number): Promise<void> {
    const userEntry = await queuePrisma.queue.findFirst({
      where: { userId, status: "waiting" },
    });

    if (!userEntry) {
      throw new Error("User not found in queue");
    }

    const chargerId = userEntry.chargerId;
    const currentPosition = userEntry.position;

    // Find the person behind the user (higher position number)
    const personBehind = await queuePrisma.queue.findFirst({
      where: {
        chargerId,
        status: "waiting",
        position: currentPosition + 1,
      },
    });

    if (!personBehind) {
      // User is already at the back of the queue for this charger, can't move back
      throw new Error(
        "Cannot move back - you are already at the back of the queue for this charger"
      );
    }

    // Swap positions: user moves to position + 1, person behind moves to position
    await queuePrisma.queue.update({
      where: { id: userEntry.id },
      data: { position: currentPosition + 1 },
    });

    await queuePrisma.queue.update({
      where: { id: personBehind.id },
      data: { position: currentPosition },
    });
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

  /**
   * Get user information for email notifications
   */
  private static async getUserInfo(
    userId: number
  ): Promise<{ name: string; email: string }> {
    const user = await authPrisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user || !user.email) {
      throw new Error("User not found or email not available");
    }

    return {
      name: user.name || "User",
      email: user.email,
    };
  }

  /**
   * Get charger name
   */
  private static getChargerName(chargerId: number): string {
    const chargerNames = {
      1: "Charger A",
      2: "Charger B",
      3: "Charger C",
      4: "Charger D",
      5: "Charger E",
      6: "Charger F",
      7: "Charger G",
      8: "Charger H",
    };
    return (
      chargerNames[chargerId as keyof typeof chargerNames] ||
      `Charger ${chargerId}`
    );
  }

  /**
   * Send notification to next user in queue that their charger is ready
   */
  static async notifyNextUserInQueue(chargerId: number): Promise<void> {
    try {
      const nextUser = await queuePrisma.queue.findFirst({
        where: { chargerId, status: "waiting", position: 1 },
      });

      if (nextUser) {
        const userInfo = await this.getUserInfo(nextUser.userId);
        const chargerName = this.getChargerName(chargerId);

        await EmailService.sendChargerReadyNotification(
          userInfo.email,
          userInfo.name,
          chargerName
        );

        console.log(
          `Email notification sent to ${userInfo.email} for ${chargerName}`
        );
      }
    } catch (error) {
      console.error("Failed to notify next user in queue:", error);
    }
  }
}
