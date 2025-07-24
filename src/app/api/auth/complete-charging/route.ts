import { NextRequest, NextResponse } from "next/server";
import { QueueService } from "@/lib/queue-service";

export async function POST(request: NextRequest) {
  try {
    const { userId, chargerId } = await request.json();

    if (!userId || !chargerId) {
      return NextResponse.json(
        { success: false, error: "userId and chargerId are required" },
        { status: 400 }
      );
    }

    await QueueService.completeCharging(Number(userId), Number(chargerId));

    return NextResponse.json({
      success: true,
      message: "Charging session completed successfully",
    });
  } catch (error) {
    console.error("Complete charging error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete charging",
      },
      { status: 500 }
    );
  }
}
