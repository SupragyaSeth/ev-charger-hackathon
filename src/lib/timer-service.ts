import { SupabaseService } from "./supabase-service";
import { EmailService } from "./email-service";
import { sseBroadcastEvent } from "./sse-bus";

/**
 * TimerService class to manage charging timers for queue entries
 */
export class TimerService {
  private static intervals = new Map<number, NodeJS.Timeout>();
  private static noOvertime = new Set<number>(); // entries that should auto-complete instead of overtime

  /**
   * Start a timer for a charging session
   * @param allowOvertime whether to convert to overtime (default true). If false, session auto-completes.
   */
  static async startChargingTimer(
    queueEntryId: number,
    durationMinutes: number,
    allowOvertime: boolean = true
  ) {
    console.log(
      `[TIMER] Starting timer for queue entry ${queueEntryId} with duration ${durationMinutes} minutes`
    );

    const now = new Date();
    const estimatedEndTime = new Date(
      now.getTime() + durationMinutes * 60 * 1000
    );

    console.log(
      `[TIMER] Setting charging started at: ${now.toISOString()}, estimated end: ${estimatedEndTime.toISOString()}`
    );

    // Update the database with timing information
    await SupabaseService.updateQueueEntry(queueEntryId, {
      chargingStartedAt: now.toISOString(),
      estimatedEndTime: estimatedEndTime.toISOString(),
      status: "charging",
    });

    console.log(`[TIMER] Updated database for queue entry ${queueEntryId}`);

    // Broadcast timer update via SSE
    sseBroadcastEvent("timer_started", {
      queueEntryId,
      estimatedEndTime: estimatedEndTime.toISOString(),
      durationMinutes,
    });

    // Clear any existing timer for this entry
    this.clearTimer(queueEntryId);

    // Set up "almost complete" notification timer (2 minutes before expiry)
    if (durationMinutes > 2) {
      const almostCompleteTime = (durationMinutes - 2) * 60 * 1000;
      setTimeout(async () => {
        try {
          const entry = await SupabaseService.findQueueEntry({
            id: queueEntryId,
          });

          if (entry && entry.status === "charging") {
            const userInfo = await this.getUserInfo(entry.userId);
            const chargerName = this.getChargerName(entry.chargerId);

            await EmailService.sendChargingAlmostCompleteNotification(
              userInfo.email,
              userInfo.name,
              chargerName,
              2
            );

            console.log(
              `Almost complete email sent to ${userInfo.email} for ${chargerName}`
            );

            // Broadcast almost complete status
            sseBroadcastEvent("charging_almost_complete", {
              queueEntryId,
              minutesRemaining: 2,
            });
          }
        } catch (error) {
          console.error("Failed to send almost complete email:", error);
        }
      }, almostCompleteTime);
    }

    // Set up a timer to mark as overtime when duration expires
    const timeoutId = setTimeout(async () => {
      try {
        console.log(
          `[TIMER] Timer expired for queue entry ${queueEntryId}, ${
            this.noOvertime.has(queueEntryId)
              ? "auto-completing"
              : "marking as overtime"
          }`
        );
        const entry = await SupabaseService.findQueueEntry({
          id: queueEntryId,
        });
        if (!entry) return;
        if (entry.status === "charging") {
          if (this.noOvertime.has(queueEntryId)) {
            // Auto-complete instead of overtime
            await this.completeCharging(queueEntryId);
            this.noOvertime.delete(queueEntryId);
          } else {
            const updated = await SupabaseService.updateQueueEntry(
              queueEntryId,
              {
                status: "overtime",
              }
            );
            console.log(`Queue entry ${queueEntryId} marked as overtime`);
            sseBroadcastEvent("charging_overtime", {
              queueEntryId,
              estimatedEndTime: updated.estimatedEndTime,
            });
            try {
              const userInfo = await this.getUserInfo(entry.userId);
              const chargerName = this.getChargerName(entry.chargerId);
              await EmailService.sendChargingExpiredNotification(
                userInfo.email,
                userInfo.name,
                chargerName,
                0
              );
            } catch (emailError) {
              console.error("Failed to send overtime email:", emailError);
            }
          }
        }
      } catch (error) {
        console.error(
          `Error handling timer expiry for queue entry ${queueEntryId}:`,
          error
        );
      }
    }, durationMinutes * 60 * 1000);

    this.intervals.set(queueEntryId, timeoutId);
    console.log(
      `[TIMER] Set timeout for ${durationMinutes} minutes (${
        durationMinutes * 60 * 1000
      }ms)`
    );

    if (!allowOvertime) {
      this.noOvertime.add(queueEntryId);
    } else {
      this.noOvertime.delete(queueEntryId);
    }
  }

  /**
   * Clear a timer for a queue entry
   */
  static clearTimer(queueEntryId: number) {
    const existingTimeout = this.intervals.get(queueEntryId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.intervals.delete(queueEntryId);
    }
  }

  /**
   * Complete charging and remove from queue
   */
  static async completeCharging(queueEntryId: number) {
    // Clear the timer
    this.clearTimer(queueEntryId);

    // Remove from queue
    await SupabaseService.deleteQueueEntry(queueEntryId);

    console.log(`Charging completed and queue entry ${queueEntryId} removed`);

    // Broadcast completion via SSE
    sseBroadcastEvent("charging_completed", {
      queueEntryId,
    });
  }

  /**
   * Get remaining time for a charging session in seconds
   */
  static async getRemainingTime(queueEntryId: number): Promise<number> {
    const entry = await SupabaseService.findQueueEntry({
      id: queueEntryId,
    });

    if (!entry || !entry.estimatedEndTime) {
      return 0;
    }

    const now = new Date();
    const endTime = new Date(entry.estimatedEndTime);
    const remainingMs = endTime.getTime() - now.getTime();

    // Return remaining seconds (can be negative if overtime)
    return Math.ceil(remainingMs / 1000);
  }

  /**
   * Initialize timers for existing charging sessions on server startup
   */
  static async initializeExistingTimers() {
    // NOTE: noOvertime set is in-memory only; admin-added synthetic sessions created after restart will default to allowOvertime=true
    try {
      const chargingEntries = await SupabaseService.findQueueEntries({
        status: ["charging", "overtime"],
      });

      for (const entry of chargingEntries) {
        if (entry.estimatedEndTime && entry.durationMinutes) {
          const now = new Date();
          const endTime = new Date(entry.estimatedEndTime);

          if (now >= endTime && entry.status === "charging") {
            // Already overtime, mark as such
            const updated = await SupabaseService.updateQueueEntry(entry.id, {
              status: "overtime",
            });
            // Broadcast overtime so clients update immediately on reconnect
            sseBroadcastEvent("charging_overtime", {
              queueEntryId: entry.id,
              estimatedEndTime: updated.estimatedEndTime,
            });
          } else if (entry.status === "charging") {
            // Still within time, set up timer for remaining duration
            const remainingMs = endTime.getTime() - now.getTime();
            if (remainingMs > 0) {
              const timeoutId = setTimeout(async () => {
                try {
                  const up = await SupabaseService.updateQueueEntry(entry.id, {
                    status: "overtime",
                  });
                  sseBroadcastEvent("charging_overtime", {
                    queueEntryId: entry.id,
                    estimatedEndTime: up.estimatedEndTime,
                  });
                } catch (error) {
                  console.error(
                    `Error updating overtime status for queue entry ${entry.id}:`,
                    error
                  );
                }
              }, remainingMs);

              this.intervals.set(entry.id, timeoutId);
            }
          } else if (entry.status === "overtime") {
            // Broadcast existing overtime so late subscribers get state
            sseBroadcastEvent("charging_overtime", {
              queueEntryId: entry.id,
              estimatedEndTime: entry.estimatedEndTime,
            });
          }
        }
      }

      console.log(`Initialized ${this.intervals.size} charging timers`);
    } catch (error) {
      console.error("Error initializing existing timers:", error);
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
}
