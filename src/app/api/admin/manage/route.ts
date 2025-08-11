import { NextRequest } from "next/server";
import { SupabaseService } from "@/lib/supabase-service";
import { QueueService } from "@/lib/queue-service";
import { TimerService } from "@/lib/timer-service";

// Simple shared-secret admin auth (set ADMIN_PASSWORD in env)
function isAuthorized(req: NextRequest): boolean {
  const header =
    req.headers.get("x-admin-password") || req.headers.get("authorization");
  const pwd = header?.replace(/^Bearer\s+/i, "");
  return !!pwd && pwd === process.env.ADMIN_PASSWORD;
}

function unauthorized() {
  return Response.json(
    { success: false, error: "Unauthorized" },
    { status: 401 }
  );
}

async function broadcastFullQueue() {
  try {
    // Reuse internal broadcast method
    // @ts-ignore access private for admin refresh
    await (QueueService as any).broadcastQueueUpdate();
  } catch {}
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const queue = await QueueService.getQueueWithEstimatedTimes();
    return Response.json({ success: true, data: { queue } });
  } catch (e: any) {
    return Response.json(
      { success: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}

// Actions supported:
// removeEntry: { queueEntryId }
// forceComplete: { queueEntryId } -> ends charging (frees charger)
// addCharging: { chargerId, durationMinutes, email?, name? } -> create synthetic user if needed, directly start charging
// clearQueue: {} -> clears entire queue table
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = await req.json();
    const action = body.action as string;

    if (!action) throw new Error("Missing action");

    switch (action) {
      case "removeEntry": {
        const { queueEntryId } = body;
        if (!queueEntryId) throw new Error("queueEntryId required");
        const entry = await SupabaseService.findQueueEntry({
          id: queueEntryId,
        });
        if (!entry) throw new Error("Entry not found");
        if (entry.status === "charging" || entry.status === "overtime") {
          await TimerService.completeCharging(entry.id);
        } else {
          await SupabaseService.deleteQueueEntry(entry.id);
          // Reorder remaining waiting entries globally
          await QueueService.reorderGlobalQueuePublic();
        }
        await broadcastFullQueue();
        return Response.json({ success: true });
      }

      case "forceComplete": {
        const { queueEntryId } = body;
        if (!queueEntryId) throw new Error("queueEntryId required");
        const entry = await SupabaseService.findQueueEntry({
          id: queueEntryId,
        });
        if (!entry) throw new Error("Entry not found");
        if (entry.status !== "charging" && entry.status !== "overtime") {
          throw new Error("Entry is not charging");
        }
        await TimerService.completeCharging(entry.id);
        await broadcastFullQueue();
        return Response.json({ success: true });
      }

      case "addCharging": {
        const { chargerId, durationMinutes, email, name } = body;
        if (!chargerId || !durationMinutes)
          throw new Error("chargerId and durationMinutes required");
        if (chargerId < 1 || chargerId > 8)
          throw new Error("Invalid chargerId");
        const occupied = await SupabaseService.findQueueEntry({
          chargerId,
          status: ["charging", "overtime"],
        });
        if (occupied) throw new Error("Charger currently occupied");
        let userId: number;
        let allowOvertime = true;
        if (email) {
          const existing = await SupabaseService.findUserByEmail(email);
          if (existing) {
            userId = existing.id;
          } else {
            // Unregistered provided email -> create user but flag no overtime
            const newUser = await SupabaseService.createUser({
              email,
              password: Math.random().toString(36).slice(2),
              name: name || email.split("@")[0],
            });
            userId = newUser.id;
            allowOvertime = false;
          }
        } else {
          // Synthetic user (no email) -> no overtime
          allowOvertime = false;
          const syntheticEmail = `anon_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}@placeholder.local`;
          const newUser = await SupabaseService.createUser({
            email: syntheticEmail,
            password: Math.random().toString(36).slice(2),
            name: name || "Guest",
          });
          userId = newUser.id;
        }
        const entry = await SupabaseService.createQueueEntry({
          userId,
          chargerId,
          position: 0,
          status: "charging",
          durationMinutes,
        });
        await TimerService.startChargingTimer(
          entry.id,
          durationMinutes,
          allowOvertime
        );
        await broadcastFullQueue();
        return Response.json({
          success: true,
          data: { queueEntryId: entry.id },
        });
      }

      case "clearQueue": {
        await SupabaseService.clearAllQueue();
        await broadcastFullQueue();
        return Response.json({ success: true });
      }

      default:
        throw new Error("Unknown action");
    }
  } catch (e: any) {
    return Response.json(
      { success: false, error: e?.message || "Failed" },
      { status: 400 }
    );
  }
}
