import { useEffect, useRef, useState, useCallback } from "react";
import { QueueEntry } from "@/types";
import { queueApi } from "@/lib/api-client";

interface SSEData {
  type: string;
  queue?: QueueEntry[];
  queueEntryId?: number;
  estimatedEndTime?: string; // added for overtime events
  durationMinutes?: number;
  minutesRemaining?: number;
  timestamp: number;
  [key: string]: any;
}

interface UseRealtimeQueueReturn {
  queue: QueueEntry[];
  queueUsers: Record<number, { id: number; name?: string; email?: string }>;
  isConnected: boolean;
  timersInitialized: boolean;
  reconnect: () => void;
}

export function useRealtimeQueue(): UseRealtimeQueueReturn {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [queueUsers, setQueueUsers] = useState<
    Record<number, { id: number; name?: string; email?: string }>
  >({});
  const [isConnected, setIsConnected] = useState(false);
  const [timersInitialized, setTimersInitialized] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timersRef = useRef<
    Map<number, { timer: NodeJS.Timeout; endTime: Date }>
  >(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch user details for queue entries
  const fetchQueueUsers = useCallback(async (queueData: QueueEntry[]) => {
    try {
      const userIds = Array.from(
        new Set(queueData.map((entry) => entry.userId))
      );

      if (userIds.length > 0) {
        const usersData = await queueApi.getUsers(userIds);
        const userMap: Record<
          number,
          { id: number; name?: string; email?: string }
        > = {};
        usersData.users.forEach((user: any) => {
          userMap[user.id] = user;
        });
        setQueueUsers(userMap);
      } else {
        setQueueUsers({});
      }
    } catch (error) {
      console.error("[SSE] Failed to fetch queue users:", error);
    }
  }, []);

  // Clean up timers
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(({ timer }) => clearInterval(timer));
    timersRef.current.clear();
  }, []);

  // Start smooth timer for a charging session (keeps running into overtime; remainingSeconds can go negative)
  const startSmoothTimer = useCallback(
    (queueEntryId: number, estimatedEndTime: string) => {
      // Clear existing timer if any
      const existingTimer = timersRef.current.get(queueEntryId);
      if (existingTimer) {
        clearInterval(existingTimer.timer);
      }

      const endTime = new Date(estimatedEndTime);

      // Update timer every second for smooth countdown
      const timer = setInterval(() => {
        setQueue((prevQueue) =>
          prevQueue.map((entry) => {
            if (
              entry.id === queueEntryId &&
              (entry.status === "charging" || entry.status === "overtime")
            ) {
              const now = new Date();
              const remainingMs = endTime.getTime() - now.getTime();
              const remainingSeconds = Math.ceil(remainingMs / 1000); // May be negative

              return {
                ...entry,
                remainingSeconds: remainingSeconds,
                remainingTime: Math.max(
                  0,
                  Math.ceil(remainingMs / (1000 * 60))
                ), // legacy minutes remaining non-negative
              };
            }
            return entry;
          })
        );
      }, 1000);

      timersRef.current.set(queueEntryId, { timer, endTime });
    },
    []
  );

  // Stop timer for a specific entry
  const stopTimer = useCallback((queueEntryId: number) => {
    const existingTimer = timersRef.current.get(queueEntryId);
    if (existingTimer) {
      clearInterval(existingTimer.timer);
      timersRef.current.delete(queueEntryId);
    }
  }, []);

  // Merge partial updates to a single queue entry (used when receiving events like overtime/completed)
  const mergeEntryUpdate = useCallback(
    (queueEntryId: number, patch: Partial<QueueEntry>) => {
      setQueue((prev) =>
        prev.map((e) => (e.id === queueEntryId ? { ...e, ...patch } : e))
      );
    },
    []
  );

  // Connect to SSE
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const eventSource = new EventSource("/api/events");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("[SSE] Connected to server");
        setIsConnected(true);

        // Clear reconnect timeout on successful connection
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEData = JSON.parse(event.data);
          console.log("[SSE] Received:", data);

          switch (data.type) {
            case "connected":
              console.log("[SSE] Server acknowledged connection");
              break;

            case "initial_state":
            case "queue_update":
              if (data.queue) {
                setQueue(data.queue);

                // Fetch user details for the queue
                fetchQueueUsers(data.queue);

                // (Re)start timers for charging or overtime entries
                data.queue.forEach((entry) => {
                  if (
                    (entry.status === "charging" ||
                      entry.status === "overtime") &&
                    entry.estimatedEndTime
                  ) {
                    startSmoothTimer(entry.id, entry.estimatedEndTime);
                  } else if (
                    !(
                      entry.status === "charging" || entry.status === "overtime"
                    )
                  ) {
                    stopTimer(entry.id);
                  }
                });
              }
              break;

            case "timers_initialized":
              console.log("[SSE] Server timers initialized");
              setTimersInitialized(true);
              break;

            case "timer_started":
              if (data.queueEntryId && data.estimatedEndTime) {
                // Mark entry as charging locally (in case queue update slightly lags)
                mergeEntryUpdate(data.queueEntryId, {
                  status: "charging" as any,
                  estimatedEndTime: data.estimatedEndTime,
                });
                startSmoothTimer(data.queueEntryId, data.estimatedEndTime);
              }
              break;

            case "charging_overtime":
              if (data.queueEntryId) {
                // Update status to overtime; keep timer running and allow negative remaining
                mergeEntryUpdate(data.queueEntryId, {
                  status: "overtime" as any,
                });
                if (data.estimatedEndTime) {
                  startSmoothTimer(data.queueEntryId, data.estimatedEndTime);
                }
              }
              break;

            case "charging_completed":
              if (data.queueEntryId) {
                stopTimer(data.queueEntryId);
                // Remove entry optimistically; actual removal will arrive via next queue_update
                setQueue((prev) =>
                  prev.filter((e) => e.id !== data.queueEntryId)
                );
              }
              break;

            case "charging_almost_complete":
              console.log(
                `[SSE] Charging almost complete for entry ${data.queueEntryId}`
              );
              break;

            default:
              console.log("[SSE] Unknown event type:", data.type);
              break;
          }
        } catch (error) {
          console.error("[SSE] Error parsing message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("[SSE] Connection error:", error);
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[SSE] Attempting to reconnect...");
            connect();
          }, 3000);
        }
      };
    } catch (error) {
      console.error("[SSE] Failed to create EventSource:", error);
      setIsConnected(false);
    }
  }, [fetchQueueUsers, startSmoothTimer, stopTimer, mergeEntryUpdate]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    console.log("[SSE] Manual reconnect requested");
    connect();
  }, [connect]);

  // Initial connection
  useEffect(() => {
    connect();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      clearAllTimers();
    };
  }, [connect, clearAllTimers]);

  return {
    queue,
    queueUsers,
    isConnected,
    timersInitialized,
    reconnect,
  };
}
