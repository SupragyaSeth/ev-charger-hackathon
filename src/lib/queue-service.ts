import { SupabaseService } from "./supabase-service";
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
    const user = await SupabaseService.findUserById(userId);

    if (!user) {
      throw new Error("User does not exist");
    }

    // Validate charger ID
    const validChargerIds = [1, 2, 3, 4, 5, 6, 7, 8];
    if (!validChargerIds.includes(chargerId)) {
      throw new Error("Invalid chargerId. Must be 1-8.");
    }

    // Check if user is already in queue or charging
    const existingEntry = await SupabaseService.findQueueEntry({
      userId,
      status: ["waiting", "charging"],
    });

    if (existingEntry) {
      throw new Error(
        `User is already ${
          existingEntry.status === "charging" ? "charging" : "in queue"
        }`
      );
    }

    // Find next position in queue for this charger
    const lastPosition = await SupabaseService.getLastPositionInQueue(
      chargerId
    );
    const nextPosition = lastPosition + 1;

    // Create new queue entry
    const newEntry = await SupabaseService.createQueueEntry({
      userId,
      chargerId,
      position: nextPosition,
      status: "waiting",
    });

    return newEntry;
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
    const occupiedEntry = await SupabaseService.findQueueEntry({
      chargerId,
      status: ["charging", "overtime"],
    });

    if (occupiedEntry) {
      throw new Error(
        "Charger is currently occupied. Please wait for the current user to finish."
      );
    }

    // Find the first waiting user in queue for this charger
    const queueEntry = await SupabaseService.getFirstWaitingInQueue(chargerId);

    if (!queueEntry || queueEntry.userId !== userId) {
      throw new Error("User is not first in queue or not found");
    }

    // Update status to charging
    const updated = await SupabaseService.updateQueueEntry(queueEntry.id, {
      status: "charging",
      durationMinutes,
      chargingStartedAt: new Date().toISOString(),
    });

    // Start the server-side timer
    await TimerService.startChargingTimer(queueEntry.id, durationMinutes);

    // Remove any other waiting entries for this user
    await SupabaseService.deleteQueueEntries({
      userId,
      status: "waiting",
    });

    return updated;
  }

  /**
   * Complete charging and remove from queue
   */
  static async completeCharging(
    userId: number,
    chargerId: number
  ): Promise<void> {
    console.log(`[QueueService] Completing charging for user ${userId} on charger ${chargerId}`);
    
    const chargingEntry = await SupabaseService.findQueueEntry({
      userId,
      chargerId,
      status: ["charging", "overtime"],
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

    console.log(`[QueueService] Charging duration: ${chargingDuration} minutes`);

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
    
    console.log(`[QueueService] Charging completion process finished for user ${userId}`);
  }

  /**
   * Get current queue for all chargers
   */
  static async getQueue(): Promise<QueueEntry[]> {
    return await SupabaseService.findQueueEntries();
  }

  /**
   * Get queue for a specific charger
   */
  static async getQueueForCharger(chargerId: number): Promise<QueueEntry[]> {
    return await SupabaseService.getQueueForCharger(chargerId);
  }

  /**
   * Remove user from queue
   */
  static async removeFromQueue(userId: number): Promise<void> {
    console.log(`[QueueService] Removing user ${userId} from queue`);
    
    const entries = await SupabaseService.findQueueEntries({
      userId,
      status: "waiting",
    });

    if (entries.length === 0) {
      throw new Error("User not found in queue");
    }

    // Store charger IDs and whether user was first in line for notification
    const chargerIds = [...new Set(entries.map((e) => e.chargerId))];
    const wasFirstInLine = entries.some((e) => e.position === 1);
    
    console.log(`[QueueService] User ${userId} had ${entries.length} entries, was first in line: ${wasFirstInLine}, chargers: ${chargerIds.join(', ')}`);

    // Remove user entries
    await SupabaseService.deleteQueueEntries({
      userId,
      status: "waiting",
    });

    // Reorder queues for affected chargers
    for (const chargerId of chargerIds) {
      console.log(`[QueueService] Reordering queue for charger ${chargerId}`);
      await this.reorderQueue(chargerId);

      // If user was first in line, notify the new first person
      if (wasFirstInLine) {
        console.log(`[QueueService] Notifying next user for charger ${chargerId}`);
        await this.notifyNextUserInQueue(chargerId);
      }
    }
    
    console.log(`[QueueService] Successfully removed user ${userId} from queue`);
  }

  /**
   * Move user back one spot in their queue (swap with the person behind them)
   */
  static async moveBackOneSpot(userId: number): Promise<void> {
    const userEntry = await SupabaseService.findQueueEntry({
      userId,
      status: "waiting",
    });

    if (!userEntry) {
      throw new Error("User not found in queue");
    }

    const chargerId = userEntry.chargerId;
    const currentPosition = userEntry.position;

    // Find the person behind the user (higher position number)
    const queueEntries = await SupabaseService.getQueueForCharger(chargerId);
    const personBehind = queueEntries.find(
      (entry) =>
        entry.status === "waiting" && entry.position === currentPosition + 1
    );

    if (!personBehind) {
      // User is already at the back of the queue for this charger, can't move back
      throw new Error(
        "Cannot move back - you are already at the back of the queue for this charger"
      );
    }

    // Swap positions: user moves to position + 1, person behind moves to position
    await SupabaseService.updateQueueEntry(userEntry.id, {
      position: currentPosition + 1,
    });

    await SupabaseService.updateQueueEntry(personBehind.id, {
      position: currentPosition,
    });
  }

  /**
   * Get remaining time for a charging session
   */
  static async getRemainingTime(queueEntryId: number): Promise<number> {
    return await TimerService.getRemainingTime(queueEntryId);
  }

  /**
   * Calculate estimated wait times for all queue entries
   */
  static async getQueueWithEstimatedTimes(): Promise<QueueEntry[]> {
    const queue = await SupabaseService.findQueueEntries();

    // Group by charger and calculate estimated times
    const chargerQueues: Record<number, QueueEntry[]> = {};

    // Group entries by charger
    for (const entry of queue) {
      if (!chargerQueues[entry.chargerId]) {
        chargerQueues[entry.chargerId] = [];
      }
      chargerQueues[entry.chargerId].push(entry);
    }

    const enhancedQueue: QueueEntry[] = [];
    const now = new Date();

    // Process each charger's queue
    for (const chargerId in chargerQueues) {
      const chargerQueue = chargerQueues[parseInt(chargerId)];

      // Sort by position for this charger - charging first, then by position
      chargerQueue.sort((a, b) => {
        if (a.status === "charging" || a.status === "overtime") return -1;
        if (b.status === "charging" || b.status === "overtime") return 1;
        return a.position - b.position;
      });

      let nextAvailableTime = new Date();

      for (let i = 0; i < chargerQueue.length; i++) {
        const entry = chargerQueue[i];
        const enhancedEntry = { ...entry };

        if (entry.status === "charging" || entry.status === "overtime") {
          // For currently charging users, use their actual estimated end time
          if (entry.estimatedEndTime) {
            enhancedEntry.estimatedEndTime = entry.estimatedEndTime;
            const endTime = new Date(entry.estimatedEndTime);

            // Calculate remaining time in seconds
            const remainingMs = endTime.getTime() - now.getTime();
            enhancedEntry.remainingSeconds = Math.max(
              0,
              Math.ceil(remainingMs / 1000)
            );

            // Set next available time to when this session ends
            nextAvailableTime = new Date(
              Math.max(endTime.getTime(), now.getTime())
            );
          } else {
            // If no estimated end time, assume 30 minutes from now
            const fallbackEnd = new Date(now.getTime() + 30 * 60 * 1000);
            enhancedEntry.estimatedEndTime = fallbackEnd.toISOString();
            enhancedEntry.remainingSeconds = 30 * 60; // 30 minutes in seconds
            nextAvailableTime = fallbackEnd;
          }
        } else if (entry.status === "waiting") {
          // For waiting users, calculate estimated start and end times
          const defaultDuration = 30; // Default 30 minutes if no duration specified
          const estimatedDuration = entry.durationMinutes || defaultDuration;

          // Estimated start time is when charger becomes available
          enhancedEntry.estimatedStartTime = nextAvailableTime.toISOString();

          // Estimated end time is start time + duration
          const estimatedEnd = new Date(
            nextAvailableTime.getTime() + estimatedDuration * 60 * 1000
          );
          enhancedEntry.estimatedEndTime = estimatedEnd.toISOString();

          // Calculate wait time in seconds until their turn starts
          const waitMs = nextAvailableTime.getTime() - now.getTime();
          enhancedEntry.estimatedWaitSeconds = Math.max(
            0,
            Math.ceil(waitMs / 1000)
          );

          // Update next available time for the next person in queue
          nextAvailableTime = estimatedEnd;
        }

        enhancedQueue.push(enhancedEntry);
      }
    }

    // Sort the final queue by charger ID and then by position for consistent display
    enhancedQueue.sort((a, b) => {
      if (a.chargerId !== b.chargerId) return a.chargerId - b.chargerId;

      // Within same charger, charging users first, then by position
      if (
        (a.status === "charging" || a.status === "overtime") &&
        !(b.status === "charging" || b.status === "overtime")
      )
        return -1;
      if (
        !(a.status === "charging" || a.status === "overtime") &&
        (b.status === "charging" || b.status === "overtime")
      )
        return 1;

      return a.position - b.position;
    });

    return enhancedQueue;
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
      const chargingCount = await SupabaseService.countQueueEntries({
        chargerId,
        status: ["charging", "overtime"],
      });

      const waitingCount = await SupabaseService.countQueueEntries({
        chargerId,
        status: "waiting",
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
    const waitingEntries = await SupabaseService.findQueueEntries({
      chargerId,
      status: "waiting",
    });

    // Sort by current position
    waitingEntries.sort((a, b) => a.position - b.position);

    // Update positions to be sequential
    for (let i = 0; i < waitingEntries.length; i++) {
      await SupabaseService.updateQueueEntry(waitingEntries[i].id, {
        position: i + 1,
      });
    }
  }

  /**
   * Get user information for email notifications
   */
  private static async getUserInfo(
    userId: number
  ): Promise<{ name: string; email: string }> {
    const user = await SupabaseService.findUserById(userId);

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
      console.log(`[QueueService] Looking for next user in queue for charger ${chargerId}`);
      const nextUser = await SupabaseService.getFirstWaitingInQueue(chargerId);

      if (nextUser) {
        console.log(`[QueueService] Found next user: ${nextUser.userId} at position ${nextUser.position}`);
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
      } else {
        console.log(`[QueueService] No waiting users found for charger ${chargerId}`);
      }
    } catch (error) {
      console.error("Failed to notify next user in queue:", error);
    }
  }
}
