import { NextResponse } from "next/server";
import { ApiResponse } from "@/types";

/**
 * Standardized API response creator
 */
export function createApiResponse<T>(
  data?: T,
  options?: {
    status?: number;
    error?: string;
    message?: string;
  }
): NextResponse {
  const { status = 200, error, message } = options || {};

  const response: ApiResponse<T> = {
    success: !error,
    ...(data && { data }),
    ...(error && { error }),
    ...(message && { message }),
  };

  return NextResponse.json(response, { status });
}

/**
 * Error response creator
 */
export function createErrorResponse(
  error: string,
  status: number = 500
): NextResponse {
  return createApiResponse(undefined, { error, status });
}

/**
 * Success response creator
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  return createApiResponse(data, { status, message });
}

/**
 * Async error handler for API routes
 */
export function withErrorHandler(
  handler: (req: Request) => Promise<NextResponse>
) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      console.error("API Error:", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "Internal server error"
      );
    }
  };
}
