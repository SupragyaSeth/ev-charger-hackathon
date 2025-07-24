import { NextResponse } from "next/server";
import { authPrisma } from "@/lib/prisma";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";
import bcrypt from "bcryptjs";

export const POST = withErrorHandler(async (req: Request) => {
  const { email, password } = await req.json();

  if (!email || !password) {
    return createErrorResponse("Email and password required", 400);
  }

  const user = await authPrisma.user.findUnique({ where: { email } });
  if (!user) {
    return createErrorResponse("Email not found", 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return createErrorResponse("Invalid password", 401);
  }

  return createSuccessResponse(
    {
      user: { id: user.id, email: user.email, name: user.name },
    },
    "Sign in successful"
  );
});
