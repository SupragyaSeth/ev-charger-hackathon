import { NextResponse } from "next/server";
import { authPrisma } from "@/lib/prisma";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";
import bcrypt from "bcryptjs";

export const POST = withErrorHandler(async (req: Request) => {
  const { email, password, name } = await req.json();

  if (!email.endsWith("@credosemi.com")) {
    return createErrorResponse("Must sign up with Credo email.", 403);
  }

  if (!email || !password) {
    return createErrorResponse("Email and password required", 400);
  }

  const existingUser = await authPrisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return createErrorResponse("User already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await authPrisma.user.create({
    data: { email, password: hashedPassword, name },
  });

  return createSuccessResponse(
    {
      user: { id: user.id, email: user.email, name: user.name },
    },
    "Sign up successful",
    201
  );
});
