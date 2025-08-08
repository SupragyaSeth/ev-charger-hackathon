import { NextRequest } from "next/server";
import { QueueService } from "@/lib/queue-service";
import { TimerService } from "@/lib/timer-service";

// Store active connections
const connections = new Set<ReadableStreamDefaultController>();

// Broadcast to all connected clients
export function broadcastQueueUpdate(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  console.log("[SSE] Broadcasting to", connections.size, "clients:", data.type);

  // Create a copy of connections to avoid modification during iteration
  const connectionsCopy = Array.from(connections);

  connectionsCopy.forEach((controller) => {
    try {
      // Check if controller is still valid and not closed
      if (
        (controller as any).desiredSize !== null &&
        (controller as any).desiredSize >= 0
      ) {
        controller.enqueue(new TextEncoder().encode(message));
      } else {
        // Controller is closed, remove it
        connections.delete(controller);
      }
    } catch (error) {
      console.error("Failed to send SSE message:", error);
      connections.delete(controller);
    }
  });
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
  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to our set
      connections.add(controller);

      // Send initial connection message
      try {
        const welcomeMessage = `data: ${JSON.stringify({
          type: "connected",
          timestamp: Date.now(),
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(welcomeMessage));
      } catch (error) {
        console.error("Failed to send welcome message:", error);
        connections.delete(controller);
        return;
      }

      // Send initial queue state with user information
      Promise.all([
        QueueService.getQueueWithEstimatedTimes(),
        TimerService.initializeExistingTimers(), // Initialize timers on connection
      ])
        .then(([queue]) => {
          try {
            // Check if controller is still valid before sending messages
            if (
              (controller as any).desiredSize !== null &&
              (controller as any).desiredSize >= 0
            ) {
              const initialMessage = `data: ${JSON.stringify({
                type: "initial_state",
                queue,
                timestamp: Date.now(),
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(initialMessage));

              // Send timers initialized event
              const timersMessage = `data: ${JSON.stringify({
                type: "timers_initialized",
                timestamp: Date.now(),
              })}\n\n`;
              controller.enqueue(new TextEncoder().encode(timersMessage));
            } else {
              // Controller is closed, remove it
              connections.delete(controller);
            }
          } catch (error) {
            console.error("Failed to send initial state messages:", error);
            connections.delete(controller);
          }
        })
        .catch((error) => {
          console.error("Failed to fetch initial state:", error);
          connections.delete(controller);
        });

      // Store controller reference for cleanup
      const currentController = controller;

      // Cleanup function
      const cleanup = () => {
        connections.delete(currentController);
      };

      // Add cleanup to controller
      (controller as any).cleanup = cleanup;
    },
    cancel(controller) {
      // Remove this connection when client disconnects
      connections.delete(controller);
    },
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}
