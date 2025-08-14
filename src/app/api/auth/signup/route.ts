import { SupabaseService } from "@/lib/supabase-service";
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

  const existingUser = await SupabaseService.findUserByEmail(email);
  if (existingUser) {
    return createErrorResponse("User already exists", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await SupabaseService.createUser({
    email,
    password: hashedPassword,
    name,
  });

  return createSuccessResponse(
    {
      user: { id: user.id, email: user.email, name: user.name },
    },
    "Sign up successful",
    201
  );
});
