import { NextRequest, NextResponse } from "next/server";
import { QueueService } from "@/lib/queue-service";
import { TimerService } from "@/lib/timer-service";

let timersInitialized = false;

export async function GET(request: NextRequest) {
  try {
    // Initialize timers on first request
    if (!timersInitialized) {
      try {
        await TimerService.initializeExistingTimers();
        timersInitialized = true;
        console.log("Timers initialized successfully");
      } catch (error) {
        console.error("Failed to initialize timers:", error);
      }
    }

    const queue = await QueueService.getQueue();

    // Add remaining time for charging sessions
    const queueWithTimers = await Promise.all(
      queue.map(async (entry) => {
        if (entry.status === "charging" || entry.status === "overtime") {
          const remainingSeconds = await TimerService.getRemainingTime(
            entry.id
          );
          return {
            ...entry,
            remainingSeconds,
          };
        }
        return entry;
      })
    );

    return NextResponse.json({
      success: true,
      data: { queue: queueWithTimers },
    });
  } catch (error) {
    console.error("Queue status error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get queue status",
      },
      { status: 500 }
    );
  }
}
