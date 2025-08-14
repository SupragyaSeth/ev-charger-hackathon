import { SupabaseService } from "@/lib/supabase-service";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";

export const GET = withErrorHandler(async (req: Request) => {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const id = searchParams.get("id");
  const email = searchParams.get("email");

  if (!id && !email) {
    return createErrorResponse("Missing user id or email", 400);
  }

  let user = null;
  if (id) {
    user = await SupabaseService.findUserById(Number(id));
  } else if (email) {
    user = await SupabaseService.findUserByEmail(email);
  }

  if (!user) {
    return createErrorResponse("User not found", 404);
  }

  return createSuccessResponse({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});
