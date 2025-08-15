import { SupabaseService } from "@/lib/supabase-service";
import { EmailService } from "@/lib/email-service";
import { createErrorResponse, createSuccessResponse, withErrorHandler } from "@/lib/api-utils";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const RESET_TOKEN_BYTES = 32; // raw token length
const RESET_TOKEN_TTL_MINUTES = 60; // expiry

function resolveBaseUrl(req: Request): string {
  // Explicit override if provided
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (configured) {
    // If VERSEL_URL is set without protocol, add https://
    if (!/^https?:\/\//i.test(configured)) {
      return `https://${configured}`.replace(/\/$/, "");
    }
    return configured.replace(/\/$/, "");
  }
  // Derive from request (includes actual port, e.g. localhost:3001)
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(/:$/, "");
  return `${proto}://${host}`.replace(/\/$/, "");
}

export const POST = withErrorHandler(async (req: Request) => {
  const { email } = await req.json();
  if (!email) return createErrorResponse("Email required", 400);

  const user = await SupabaseService.findUserByEmail(email);
  if (!user) {
    // Explicitly inform client that email does not exist
    return createErrorResponse("Email not found", 404);
  }

  // Generate token
  const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  // Persist token (invalidate old existing tokens for same user)
  await SupabaseService.storePasswordResetToken(user.id, tokenHash, expiresAt);

  const baseUrl = resolveBaseUrl(req);
  const resetLink = `${baseUrl}/auth/reset-password?token=${rawToken}`;

  const subject = "Password Reset Instructions";
  const html = `
    <p>Hi${user.name ? ` ${user.name}` : ""},</p>
    <p>We received a request to reset your password. Click the link below to choose a new password:</p>
    <p><a href="${resetLink}" target="_blank" rel="noopener">Reset Password</a></p>
    <p>This link will expire in ${RESET_TOKEN_TTL_MINUTES} minutes. If you did not request a password reset, you can ignore this email.</p>
    <p>EV Charging Station</p>
  `;

  try {
    await EmailService.sendEmail({ to: user.email, subject, html });
  } catch (e) {
    return createErrorResponse("Failed to send reset email", 500);
  }

  return createSuccessResponse({ sent: true }, "Reset email sent");
});
