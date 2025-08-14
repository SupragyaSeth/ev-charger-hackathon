import { NextRequest } from "next/server";
import { QueueService } from "@/lib/queue-service";
import { TimerService } from "@/lib/timer-service";
import {
  registerSSEController,
  unregisterSSEController,
  sendDirect,
} from "@/lib/sse-bus";

interface InitialStatePayload {
  [key: string]: unknown;
  type: string;
  timestamp: number;
  queue?: unknown;
}

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      registerSSEController(controller);

      const send = (obj: InitialStatePayload) => sendDirect(controller, obj);

      request.signal.addEventListener("abort", () => {
        unregisterSSEController(controller);
      });

      // Heartbeat
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", timestamp: Date.now() });
      }, 25000);
      (controller as unknown as { _heartbeat?: NodeJS.Timeout })._heartbeat =
        heartbeat;

      send({ type: "connected", timestamp: Date.now() });

      Promise.all([
        QueueService.getQueueWithEstimatedTimes(),
        TimerService.initializeExistingTimers(),
      ])
        .then(([queue]) => {
          send({ type: "initial_state", queue, timestamp: Date.now() });
          send({ type: "timers_initialized", timestamp: Date.now() });
        })
        .catch((error) => {
          console.error("Failed to fetch initial state:", error);
          unregisterSSEController(controller);
        });
    },
    cancel(controller) {
      unregisterSSEController(controller);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Transfer-Encoding": "chunked",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
