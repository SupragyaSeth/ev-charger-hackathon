import { SupabaseService } from "@/lib/supabase-service";
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
  const users = [];
  for (const id of userIds) {
    const user = await SupabaseService.findUserById(Number(id));
    if (user) {
      users.push({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    }
  }

  return createSuccessResponse({ users });
});
