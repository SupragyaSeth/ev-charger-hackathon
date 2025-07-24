import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma/queue/client";

const prisma = new PrismaClient();

/**
 * GET /api/auth/queue
 * Returns the current queue with all entries
 */
export async function GET() {
  try {
    const queueEntries = await prisma.queue.findMany({
      orderBy: [{ chargerId: "asc" }, { position: "asc" }],
    });

    return NextResponse.json({ queue: queueEntries });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch queue" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/queue
 * Body: { userId: number, chargerId: number }
 * Adds user to queue for a specific charger
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, chargerId } = body;

    if (!userId || !chargerId) {
      return NextResponse.json(
        { error: "Missing userId or chargerId" },
        { status: 400 }
      );
    }

    // Check if user is already in the queue for this charger
    const existingEntry = await prisma.queue.findFirst({
      where: { userId, chargerId },
    });

    if (existingEntry) {
      return NextResponse.json(
        {
          message: "User is already in the queue for this charger",
          queueEntry: existingEntry,
        },
        { status: 200 }
      );
    }

    // Find current max position in queue for this charger
    const lastInQueue = await prisma.queue.findFirst({
      where: { chargerId },
      orderBy: { position: "desc" },
    });

    const nextPosition = lastInQueue ? lastInQueue.position + 1 : 1;

    // Create new queue entry
    const newEntry = await prisma.queue.create({
      data: {
        userId,
        chargerId,
        position: nextPosition,
      },
    });

    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to add to queue" },
      { status: 500 }
    );
  }
}
