import { SupabaseService } from "./supabase-service";
import { QueueEntry } from "@/types";
import { TimerService } from "./timer-service";
import { EmailService } from "./email-service";

// Import the broadcast functions
let broadcastQueueUpdate: ((data: any) => void) | null = null;
let broadcastEvent: ((eventType: string, data: any) => void) | null = null;

// Dynamically import to avoid circular dependency
async function getBroadcastFunctions() {
  if (!broadcastQueueUpdate || !broadcastEvent) {
    try {
      const { 
        broadcastQueueUpdate: broadcast, 
        broadcastEvent: broadcastEventFn 
      } = await import('@/app/api/events/route');
      broadcastQueueUpdate = broadcast;
      broadcastEvent = broadcastEventFn;
    } catch (error) {
      console.warn('Could not import broadcast functions:', error);
    }
  }
  return { broadcastQueueUpdate, broadcastEvent };
}

export class QueueService {
  /**
   * Broadcast queue update via SSE
   */
  private static async broadcastQueueUpdate() {
    try {
      const { broadcastQueueUpdate } = await getBroadcastFunctions();
      if (broadcastQueueUpdate) {
        const queue = await this.getQueueWithEstimatedTimes();
        broadcastQueueUpdate({
          type: 'queue_update',
          queue,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.warn('Failed to broadcast queue update:', error);
    }
  }

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

    // Find next position in GLOBAL queue (not per charger)
    const allWaitingEntries = await SupabaseService.findQueueEntries({
      status: "waiting",
    });
    const nextPosition = allWaitingEntries.length + 1;

    // Create new queue entry - initially without specific charger assignment
    // Charger will be assigned when they reach position 1 and a charger becomes available
    const newEntry = await SupabaseService.createQueueEntry({
      userId,
      chargerId: 0, // Placeholder - will be assigned when charger becomes available
      position: nextPosition,
      status: "waiting",
    });

    // If this user is now first in line, check for available chargers and auto-assign
    if (nextPosition === 1) {
      await this.assignChargersToWaitingUsers();
    }

    // Broadcast queue update
    await this.broadcastQueueUpdate();

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
    console.log(
      `[QueueService] Starting charging for user ${userId} on charger ${chargerId}`
    );

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

    // Find the user's queue entry - they should be first in line for ANY charger
    const userEntry = await SupabaseService.findQueueEntry({
      userId,
      status: "waiting",
    });

    if (!userEntry || userEntry.position !== 1) {
      throw new Error("User is not first in queue or not found");
    }

    // Verify this charger is actually available (not just unoccupied)
    const availableChargers = await this.getAvailableChargers();
    if (!availableChargers.includes(chargerId)) {
      throw new Error("Selected charger is not available");
    }

    // Update the user's entry to charging status and assign the charger
    const updated = await SupabaseService.updateQueueEntry(userEntry.id, {
      status: "charging",
      chargerId: chargerId, // Update to the selected charger
      durationMinutes,
      chargingStartedAt: new Date().toISOString(),
    });

    // Start the server-side timer
    await TimerService.startChargingTimer(userEntry.id, durationMinutes);

    // Remove any other waiting entries for this user (shouldn't exist, but cleanup)
    await SupabaseService.deleteQueueEntries({
      userId,
      status: "waiting",
    });

    // Reorder the global queue after this user starts charging
    await this.reorderGlobalQueue();

    // Check if more chargers are available and assign them to next users
    await this.assignChargersToWaitingUsers();

    console.log(
      `[QueueService] User ${userId} started charging on charger ${chargerId}`
    );
    return updated;
  }

  /**
   * Complete charging and remove from queue
   */
  static async completeCharging(
    userId: number,
    chargerId: number
  ): Promise<void> {
    console.log(
      `[QueueService] Completing charging for user ${userId} on charger ${chargerId}`
    );

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

    console.log(
      `[QueueService] Charging duration: ${chargingDuration} minutes`
    );

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

    // Check if there are people waiting and assign the newly available charger
    await this.assignChargersToWaitingUsers();

    // Broadcast queue update
    await this.broadcastQueueUpdate();

    console.log(
      `[QueueService] Charging completion process finished for user ${userId}`
    );
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

    const userEntry = entries[0]; // Should only be one waiting entry per user
    const wasFirstInLine = userEntry.position === 1;

    console.log(
      `[QueueService] User ${userId} was at position ${userEntry.position}, first in line: ${wasFirstInLine}`
    );

    // Remove user entries
    await SupabaseService.deleteQueueEntries({
      userId,
      status: "waiting",
    });

    // Reorder the global queue
    await this.reorderGlobalQueue();

    // If user was first in line, check for available chargers for the new first person
    if (wasFirstInLine) {
      console.log(
        `[QueueService] User was first in line, assigning chargers to next users`
      );
      await this.assignChargersToWaitingUsers();
    }

    console.log(
      `[QueueService] Successfully removed user ${userId} from queue`
    );

    // Broadcast queue update
    await this.broadcastQueueUpdate();
  }

  /**
   * Move user back one spot in the global queue
   */
  static async moveBackOneSpot(userId: number): Promise<void> {
    console.log(`[QueueService] Moving user ${userId} back one spot`);

    const userEntry = await SupabaseService.findQueueEntry({
      userId,
      status: "waiting",
    });

    if (!userEntry) {
      throw new Error("User not found in queue");
    }

    const currentPosition = userEntry.position;

    // Check if user has been assigned a charger (chargerId > 0)
    if (userEntry.chargerId > 0) {
      // User has been assigned a charger - check if there are unassigned users behind them
      const allWaitingEntries = await SupabaseService.findQueueEntries({
        status: "waiting",
      });

      const unassignedUsersBehind = allWaitingEntries.filter(
        (entry) => entry.position > currentPosition && entry.chargerId === 0
      );

      if (unassignedUsersBehind.length === 0) {
        throw new Error(
          "Cannot move back - you have been assigned a charger and there are no unassigned users behind you. You must either take the charger or leave the queue entirely."
        );
      }
    }

    // Find the person behind the user (higher position number)
    const allWaitingEntries = await SupabaseService.findQueueEntries({
      status: "waiting",
    });

    const personBehind = allWaitingEntries.find(
      (entry) => entry.position === currentPosition + 1
    );

    if (!personBehind) {
      throw new Error(
        "Cannot move back - you are already at the back of the queue"
      );
    }

    // If user had an assigned charger, transfer it to the person behind them
    if (userEntry.chargerId > 0) {
      await SupabaseService.updateQueueEntry(personBehind.id, {
        chargerId: userEntry.chargerId,
      });

      await SupabaseService.updateQueueEntry(userEntry.id, {
        chargerId: 0, // Remove charger assignment
      });
    }

    // Swap positions: user moves to position + 1, person behind moves to position
    await SupabaseService.updateQueueEntry(userEntry.id, {
      position: currentPosition + 1,
    });

    await SupabaseService.updateQueueEntry(personBehind.id, {
      position: currentPosition,
    });

    // If someone is now first in line, check for available chargers and auto-assign
    if (currentPosition === 1) {
      await this.assignChargersToWaitingUsers();
    }

    // Broadcast queue update
    await this.broadcastQueueUpdate();

    console.log(
      `[QueueService] User ${userId} moved from position ${currentPosition} to ${
        currentPosition + 1
      }`
    );
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
    const now = new Date();

    // Get available chargers
    const availableChargers = await this.getAvailableChargers();

    // Separate charging and waiting entries
    const chargingEntries = queue.filter(
      (entry) => entry.status === "charging" || entry.status === "overtime"
    );
    const waitingEntries = queue.filter((entry) => entry.status === "waiting");

    // Sort waiting entries by position
    waitingEntries.sort((a, b) => a.position - b.position);

    const enhancedQueue: QueueEntry[] = [];

    // Process charging entries
    for (const entry of chargingEntries) {
      const enhancedEntry = { ...entry };

      if (entry.estimatedEndTime) {
        const endTime = new Date(entry.estimatedEndTime);
        const remainingMs = endTime.getTime() - now.getTime();
        enhancedEntry.remainingSeconds = Math.max(
          0,
          Math.ceil(remainingMs / 1000)
        );
      } else {
        // Fallback if no estimated end time
        enhancedEntry.remainingSeconds = 30 * 60; // 30 minutes
      }

      enhancedQueue.push(enhancedEntry);
    }

    // Process waiting entries with global queue logic
    for (let i = 0; i < waitingEntries.length; i++) {
      const entry = waitingEntries[i];
      const enhancedEntry = { ...entry };

      if (i < availableChargers.length) {
        // User can start immediately
        enhancedEntry.estimatedStartTime = now.toISOString();
        enhancedEntry.estimatedWaitSeconds = 0;

        const defaultDuration = 30; // Default 30 minutes
        const estimatedDuration = entry.durationMinutes || defaultDuration;
        const estimatedEnd = new Date(
          now.getTime() + estimatedDuration * 60 * 1000
        );
        enhancedEntry.estimatedEndTime = estimatedEnd.toISOString();
      } else {
        // User needs to wait - calculate based on position and charging sessions
        const defaultDuration = 30; // Default session duration

        // Find the earliest finishing time among current charging sessions
        let earliestAvailableTime = now;

        if (chargingEntries.length > 0) {
          const chargingEndTimes = chargingEntries.map((ce) => {
            if (ce.estimatedEndTime) {
              return new Date(ce.estimatedEndTime);
            }
            return new Date(now.getTime() + 30 * 60 * 1000); // 30 min fallback
          });

          chargingEndTimes.sort((a, b) => a.getTime() - b.getTime());
          earliestAvailableTime = chargingEndTimes[0];
        }

        // Calculate wait time based on position in queue
        const queuePosition = i - availableChargers.length + 1;
        const additionalWaitMinutes =
          Math.max(0, queuePosition - 1) * defaultDuration;

        const estimatedStartTime = new Date(
          earliestAvailableTime.getTime() + additionalWaitMinutes * 60 * 1000
        );

        enhancedEntry.estimatedStartTime = estimatedStartTime.toISOString();
        enhancedEntry.estimatedWaitSeconds = Math.max(
          0,
          Math.ceil((estimatedStartTime.getTime() - now.getTime()) / 1000)
        );

        const estimatedDuration = entry.durationMinutes || defaultDuration;
        const estimatedEnd = new Date(
          estimatedStartTime.getTime() + estimatedDuration * 60 * 1000
        );
        enhancedEntry.estimatedEndTime = estimatedEnd.toISOString();
      }

      enhancedQueue.push(enhancedEntry);
    }

    // Sort for consistent display: charging first, then by position
    enhancedQueue.sort((a, b) => {
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
   * Since we now use a global queue, this just returns any available charger
   * or the first charger if none are available (user will wait in global queue)
   */
  static async findBestCharger(): Promise<number> {
    const availableChargers = await this.getAvailableChargers();

    if (availableChargers.length > 0) {
      // Return the first available charger
      return availableChargers[0];
    }

    // If no chargers available, return charger 1 as placeholder
    // The actual charger will be assigned when user reaches front of queue
    return 1;
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
   * Reorder global queue positions to be sequential
   */
  private static async reorderGlobalQueue(): Promise<void> {
    const waitingEntries = await SupabaseService.findQueueEntries({
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
   * Get list of available charger IDs
   */
  private static async getAvailableChargers(): Promise<number[]> {
    const availableChargers: number[] = [];

    for (let chargerId = 1; chargerId <= 8; chargerId++) {
      const occupiedEntry = await SupabaseService.findQueueEntry({
        chargerId,
        status: ["charging", "overtime"],
      });

      if (!occupiedEntry) {
        availableChargers.push(chargerId);
      }
    }

    return availableChargers;
  }

  /**
   * Automatically assign available chargers to waiting users in order
   */
  private static async assignChargersToWaitingUsers(): Promise<void> {
    try {
      console.log(`[QueueService] Assigning chargers to waiting users`);

      const availableChargers = await this.getAvailableChargers();
      console.log(
        `[QueueService] Available chargers: ${availableChargers.join(", ")}`
      );

      if (availableChargers.length === 0) {
        console.log(`[QueueService] No available chargers to assign`);
        return;
      }

      // Get unassigned users waiting in order (chargerId = 0)
      const waitingEntries = await SupabaseService.findQueueEntries({
        status: "waiting",
      });

      const unassignedUsers = waitingEntries
        .filter((entry) => entry.chargerId === 0)
        .sort((a, b) => a.position - b.position);

      console.log(
        `[QueueService] Found ${unassignedUsers.length} unassigned waiting users`
      );

      // Assign chargers to users in order
      const assignmentsToMake = Math.min(
        availableChargers.length,
        unassignedUsers.length
      );

      for (let i = 0; i < assignmentsToMake; i++) {
        const user = unassignedUsers[i];
        const chargerId = availableChargers[i];

        console.log(
          `[QueueService] Assigning charger ${chargerId} to user ${user.userId} at position ${user.position}`
        );

        await SupabaseService.updateQueueEntry(user.id, {
          chargerId: chargerId,
        });

        // Send notification to user about their assigned charger
        const userInfo = await this.getUserInfo(user.userId);
        const chargerName = this.getChargerName(chargerId);

        await EmailService.sendChargerReadyNotification(
          userInfo.email,
          userInfo.name,
          chargerName
        );

        console.log(
          `[QueueService] Assigned ${chargerName} to ${userInfo.email}`
        );
      }

      // Broadcast queue update after assignments
      await this.broadcastQueueUpdate();
    } catch (error) {
      console.error("Failed to assign chargers to waiting users:", error);
    }
  }

  /**
   * Notify users about available chargers when multiple chargers become available
   * Now replaced by automatic charger assignment
   */
  private static async notifyAvailableChargerUsers(): Promise<void> {
    // Replace manual notification with automatic assignment
    await this.assignChargersToWaitingUsers();
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
      console.log(
        `[QueueService] Looking for next user in queue for charger ${chargerId}`
      );
      const nextUser = await SupabaseService.getFirstWaitingInQueue(chargerId);

      if (nextUser) {
        console.log(
          `[QueueService] Found next user: ${nextUser.userId} at position ${nextUser.position}`
        );
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
        console.log(
          `[QueueService] No waiting users found for charger ${chargerId}`
        );
      }
    } catch (error) {
      console.error("Failed to notify next user in queue:", error);
    }
  }
}
