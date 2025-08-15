import { SupabaseService } from "@/lib/supabase-service";
import { createErrorResponse, createSuccessResponse, withErrorHandler } from "@/lib/api-utils";
import bcrypt from "bcryptjs";

export const POST = withErrorHandler(async (req: Request) => {
  const { token, password } = await req.json();
  if (!token || !password) return createErrorResponse("Token and password required", 400);
  if (password.length < 8) return createErrorResponse("Password too short", 400);

  const tokenRecord = await SupabaseService.findValidPasswordResetToken(token);
  if (!tokenRecord) return createErrorResponse("Invalid or expired token", 400);

  const hashed = await bcrypt.hash(password, 10);
  await SupabaseService.updateUserPassword(tokenRecord.userId, hashed);
  await SupabaseService.markPasswordResetTokenUsed(tokenRecord.id);

  return createSuccessResponse({ reset: true }, "Password updated successfully");
});
