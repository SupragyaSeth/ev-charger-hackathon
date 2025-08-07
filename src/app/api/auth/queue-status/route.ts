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

    // Get queue with enhanced estimated times
    const queueWithEstimatedTimes =
      await QueueService.getQueueWithEstimatedTimes();

    return NextResponse.json({
      success: true,
      data: { queue: queueWithEstimatedTimes },
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
