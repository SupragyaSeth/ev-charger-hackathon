import { queuePrisma } from "./prisma";

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
}
