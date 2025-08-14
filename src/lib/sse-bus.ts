// Central SSE bus to avoid exporting disallowed symbols from API route files.

interface SSEPayload {
  [key: string]: unknown;
}

const connections = new Set<ReadableStreamDefaultController>();
const OPEN_FLAG = Symbol("open");
const HEARTBEAT = Symbol("heartbeat");

declare global {
  interface ReadableStreamDefaultController {
    [OPEN_FLAG]?: boolean;
    [HEARTBEAT]?: NodeJS.Timeout;
  }
}

function controllerIsWritable(controller: ReadableStreamDefaultController) {
  return controller[OPEN_FLAG] === true;
}

function markClosed(controller: ReadableStreamDefaultController) {
  controller[OPEN_FLAG] = false;
}

function tryEnqueue(
  controller: ReadableStreamDefaultController,
  payload: string,
  logOnError = false
) {
  if (!controllerIsWritable(controller)) return;
  try {
    controller.enqueue(new TextEncoder().encode(payload));
  } catch {
    if (logOnError) console.warn("[SSE] enqueue after close suppressed");
    connections.delete(controller);
    markClosed(controller);
  }
}

export function registerSSEController(
  controller: ReadableStreamDefaultController
) {
  controller[OPEN_FLAG] = true;
  connections.add(controller);
}

export function unregisterSSEController(
  controller: ReadableStreamDefaultController
) {
  connections.delete(controller);
  markClosed(controller);
  const hb = controller[HEARTBEAT];
  if (hb) clearInterval(hb);
}

export function sendDirect(
  controller: ReadableStreamDefaultController,
  obj: SSEPayload
) {
  tryEnqueue(controller, `data: ${JSON.stringify(obj)}\n\n`);
}

export function sseBroadcast(data: SSEPayload) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  Array.from(connections).forEach((c) => tryEnqueue(c, msg));
}

export function sseBroadcastEvent(eventType: string, data: SSEPayload) {
  sseBroadcast({ type: eventType, ...data, timestamp: Date.now() });
}
