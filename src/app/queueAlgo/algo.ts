// --- Configuration Constants ---

// Maximum delay (in milliseconds) when the queue is empty or light.
// This simulates slow polling or low urgency.
const MAX_DURATION_MS = 5000; // 5 seconds

// Minimum delay (in milliseconds) when the queue is very long.
const MIN_DURATION_MS = 500;  // 0.5 seconds

// The maximum queue size used for scaling. Any queue longer than this
// is treated as "very full" and gets the minimum delay.
const MAX_QUEUE_SIZE = 20;


// --- Sample Queue (Replace with real EV charger queue logic) ---

// Simulated queue of tasks (e.g., cars waiting for a charger)
const queue: string[] = ["task1", "task2", "task3"];


// --- Delay Computation Function ---

/**
 * Computes a delay time based on the current queue length.
 * Longer queues result in shorter delays (higher urgency).
 * 
 * @param queueLength - Number of items currently in the queue
 * @returns Delay duration in milliseconds
 */
function computeDelay(queueLength: number): number {
  // Clamp the queue length to a max threshold for consistent scaling
  const clampedLength = Math.min(queueLength, MAX_QUEUE_SIZE);

  // Ratio between 0 and 1 representing queue fullness
  const ratio = clampedLength / MAX_QUEUE_SIZE;

  // Interpolate between max and min durations (inverse relationship)
  const delay = MAX_DURATION_MS - ratio * (MAX_DURATION_MS - MIN_DURATION_MS);

  // Return final delay, ensuring it's not below the minimum
  return Math.max(MIN_DURATION_MS, delay);
}


// --- Task Scheduler Loop ---

/**
 * Continuously schedules and processes tasks in the queue.
 * Adjusts timing dynamically based on how long the queue is.
 */
function scheduleNextTask() {
  // Compute dynamic delay based on current queue length
  const delay = computeDelay(queue.length);

  // Log status for debugging/monitoring
  console.log(`Queue length: ${queue.length}, Scheduling next task in ${delay} ms`);

  // Schedule next processing cycle after computed delay
  setTimeout(() => {
    if (queue.length > 0) {
      // Remove and process the next task in the queue
      const task = queue.shift();
      console.log(`Processing: ${task}`);
    }

    // Continue scheduling future tasks
    scheduleNextTask();
  }, delay);
}


// --- Start the loop for the first time ---
scheduleNextTask();
