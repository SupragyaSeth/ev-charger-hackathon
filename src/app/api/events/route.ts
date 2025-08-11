import { NextRequest } from "next/server";
import { QueueService } from "@/lib/queue-service";
import { TimerService } from "@/lib/timer-service";

// Store active connections
const connections = new Set<ReadableStreamDefaultController>();

// Helper to determine if controller is writable
function controllerIsWritable(controller: ReadableStreamDefaultController) {
  try {
    // If any enqueue after close will throw; we optimistically test by checking a flag we set
    return (controller as any)._open === true; // we manage this flag
  } catch {
    return false;
  }
}

function markClosed(controller: ReadableStreamDefaultController) {
  (controller as any)._open = false;
}

function register(controller: ReadableStreamDefaultController) {
  (controller as any)._open = true;
  connections.add(controller);
}

function tryEnqueue(
  controller: ReadableStreamDefaultController,
  payload: string,
  logOnError = false
) {
  if (!controllerIsWritable(controller)) return; // already closed
  try {
    controller.enqueue(new TextEncoder().encode(payload));
  } catch (e) {
    // Suppress noisy invalid state errors once closed
    if (logOnError) {
      console.warn("[SSE] Suppressed enqueue after close");
    }
    connections.delete(controller);
    markClosed(controller);
  }
}

// Broadcast to all connected clients
export function broadcastQueueUpdate(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  // console.log removed to reduce noise
  const copy = Array.from(connections);
  copy.forEach((c) => tryEnqueue(c, message));
}

// Enhanced broadcast function for different event types
export function broadcastEvent(eventType: string, data: any) {
  broadcastQueueUpdate({
    type: eventType,
    ...data,
    timestamp: Date.now(),
  });
}

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      register(controller);

      const send = (obj: any) =>
        tryEnqueue(controller, `data: ${JSON.stringify(obj)}\n\n`);

      // Handle client disconnect (Next.js sets abort on client close)
      request.signal.addEventListener("abort", () => {
        connections.delete(controller);
        markClosed(controller);
      });

      // Heartbeat every 25s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        send({ type: "heartbeat", timestamp: Date.now() });
      }, 25000);
      (controller as any)._heartbeat = heartbeat;

      // Initial messages
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
          connections.delete(controller);
          markClosed(controller);
        });
    },
    cancel(controller) {
      connections.delete(controller);
      markClosed(controller);
      const hb = (controller as any)._heartbeat;
      if (hb) clearInterval(hb);
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
