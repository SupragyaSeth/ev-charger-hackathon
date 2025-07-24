import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authPrisma } from "@/lib/prisma";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  const email = searchParams.get("email");

  if (!id && !email) {
    return createErrorResponse("Missing user id or email", 400);
  }

  let user = null;
  if (id) {
    user = await authPrisma.user.findUnique({
      where: { id: Number(id) },
      select: { id: true, name: true, email: true },
    });
  } else if (email) {
    user = await authPrisma.user.findUnique({
      where: { email: email },
      select: { id: true, name: true, email: true },
    });
  }

  if (!user) {
    return createErrorResponse("User not found", 404);
  }

  return createSuccessResponse({ user });
});
