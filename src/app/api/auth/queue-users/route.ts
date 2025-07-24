import { NextResponse } from "next/server";
import { authPrisma } from "@/lib/prisma";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";

/**
 * POST /api/auth/queue-users
 * Body: { userIds: number[] }
 * Returns user information for the provided user IDs
 */
export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const { userIds } = body;

  if (!userIds || !Array.isArray(userIds)) {
    return createErrorResponse("userIds array is required", 400);
  }

  // Fetch users by IDs
  const users = await authPrisma.user.findMany({
    where: {
      id: {
        in: userIds.map((id) => Number(id)),
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  return createSuccessResponse({ users });
});
