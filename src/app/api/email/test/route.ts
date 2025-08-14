import { EmailService } from "@/lib/email-service";
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-utils";

/**
 * POST /api/email/test
 * Body: { type: "charger-ready" | "almost-complete" | "expired" | "complete", userEmail: string, userName?: string }
 * Send a test email notification
 */
export const POST = withErrorHandler(async (req: Request) => {
  const body = await req.json();
  const { type, userEmail, userName = "Test User" } = body;

  if (!type || !userEmail) {
    return createErrorResponse("Missing type or userEmail", 400);
  }

  const chargerName = "Charger A";

  try {
    switch (type) {
      case "charger-ready":
        await EmailService.sendChargerReadyNotification(
          userEmail,
          userName,
          chargerName
        );
        break;

      case "almost-complete":
        await EmailService.sendChargingAlmostCompleteNotification(
          userEmail,
          userName,
          chargerName,
          2
        );
        break;

      case "expired":
        await EmailService.sendChargingExpiredNotification(
          userEmail,
          userName,
          chargerName,
          5
        );
        break;

      case "complete":
        await EmailService.sendChargingCompleteNotification(
          userEmail,
          userName,
          chargerName,
          120
        );
        break;

      default:
        return createErrorResponse("Invalid email type", 400);
    }

    return createSuccessResponse(
      null,
      `Test ${type} email sent successfully to ${userEmail}`
    );
  } catch (error) {
    console.error("Failed to send test email:", error);
    return createErrorResponse("Failed to send test email", 500);
  }
});

/**
 * GET /api/email/test
 * Get email configuration status
 */
export const GET = withErrorHandler(async () => {
  const hasConfig = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

  return createSuccessResponse(
    {
      configured: hasConfig,
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || "587",
      user: hasConfig
        ? process.env.SMTP_USER?.replace(/(.{2}).*(@.*)/g, "$1***$2")
        : "Not configured",
    },
    hasConfig ? "Email is configured" : "Email is not configured"
  );
});
