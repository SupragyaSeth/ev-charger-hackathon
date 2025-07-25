import { queuePrisma, authPrisma } from "./prisma";
import { EmailService } from "./email-service";

export class TimerService {
  private static intervals = new Map<number, NodeJS.Timeout>();

  /**
   * Start a timer for a charging session
   */
  static async startChargingTimer(
    queueEntryId: number,
    durationMinutes: number
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
    await queuePrisma.queue.update({
      where: { id: queueEntryId },
      data: {
        chargingStartedAt: now,
        estimatedEndTime: estimatedEndTime,
        status: "charging",
      },
    });

    console.log(`[TIMER] Updated database for queue entry ${queueEntryId}`);

    // Clear any existing timer for this entry
    this.clearTimer(queueEntryId);

    // Set up "almost complete" notification timer (2 minutes before expiry)
    if (durationMinutes > 2) {
      const almostCompleteTime = (durationMinutes - 2) * 60 * 1000;
      setTimeout(async () => {
        try {
          const entry = await queuePrisma.queue.findUnique({
            where: { id: queueEntryId },
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
          `[TIMER] Timer expired for queue entry ${queueEntryId}, marking as overtime`
        );
        // Check if the entry still exists and is still charging
        const entry = await queuePrisma.queue.findUnique({
          where: { id: queueEntryId },
        });

        if (entry && entry.status === "charging") {
          // Mark as overtime
          await queuePrisma.queue.update({
            where: { id: queueEntryId },
            data: { status: "overtime" },
          });

          console.log(`Queue entry ${queueEntryId} marked as overtime`);

          // Send overtime email notification
          try {
            const userInfo = await this.getUserInfo(entry.userId);
            const chargerName = this.getChargerName(entry.chargerId);

            await EmailService.sendChargingExpiredNotification(
              userInfo.email,
              userInfo.name,
              chargerName,
              0 // Initially 0 minutes over
            );

            console.log(
              `Overtime email sent to ${userInfo.email} for ${chargerName}`
            );
          } catch (emailError) {
            console.error("Failed to send overtime email:", emailError);
          }
        }
      } catch (error) {
        console.error(
          `Error updating overtime status for queue entry ${queueEntryId}:`,
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
    await queuePrisma.queue.delete({
      where: { id: queueEntryId },
    });

    console.log(`Charging completed and queue entry ${queueEntryId} removed`);
  }

  /**
   * Get remaining time for a charging session in seconds
   */
  static async getRemainingTime(queueEntryId: number): Promise<number> {
    const entry = await queuePrisma.queue.findUnique({
      where: { id: queueEntryId },
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
    try {
      const chargingEntries = await queuePrisma.queue.findMany({
        where: {
          status: { in: ["charging", "overtime"] },
          estimatedEndTime: { not: null },
        },
      });

      for (const entry of chargingEntries) {
        if (entry.estimatedEndTime && entry.durationMinutes) {
          const now = new Date();
          const endTime = new Date(entry.estimatedEndTime);

          if (now >= endTime && entry.status === "charging") {
            // Already overtime, mark as such
            await queuePrisma.queue.update({
              where: { id: entry.id },
              data: { status: "overtime" },
            });
          } else if (entry.status === "charging") {
            // Still within time, set up timer for remaining duration
            const remainingMs = endTime.getTime() - now.getTime();
            if (remainingMs > 0) {
              const timeoutId = setTimeout(async () => {
                try {
                  await queuePrisma.queue.update({
                    where: { id: entry.id },
                    data: { status: "overtime" },
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
}
