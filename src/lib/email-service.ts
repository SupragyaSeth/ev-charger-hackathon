import nodemailer from "nodemailer";

// Environment-derived email configuration
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "EV Charging Station";

// Build transport config only if required vars exist
const EMAIL_CONFIG = {
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465 (SSL), false for STARTTLS
  auth:
    SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
} as const;

// Lazily create transporter (will fail fast if host missing)
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static fromAddress(): string {
    if (!SMTP_FROM_EMAIL) {
      throw new Error("SMTP_FROM_EMAIL not configured");
    }
    return `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`;
  }
  /**
   * Send an email notification
   */
  static async sendEmail(options: EmailOptions): Promise<void> {
    try {
      // Basic validation
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
        console.warn(
          "Email not fully configured (missing one of host/user/pass/from). Skipping send."
        );
        return;
      }

      const mailOptions = {
        from: this.fromAddress(),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ""),
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent", info.messageId);

      // (Optional) Ethereal preview support if using test host
      if (SMTP_HOST?.includes("ethereal")) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) console.log(`🔗 Preview: ${previewUrl}`);
      }
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error("Email delivery failed");
    }
  }

  /**
   * Send notification when charger is ready for user
   */
  static async sendChargerReadyNotification(
    userEmail: string,
    userName: string,
    chargerName: string
  ): Promise<void> {
    const subject = "🔌 Your EV Charger is Ready!";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">EV Charging Station</h1>
        </div>
        
        <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">Your Charger is Ready!</h2>
          <p style="font-size: 16px; margin-bottom: 10px;">Hi ${userName},</p>
          <p style="font-size: 16px; margin-bottom: 15px;">
            Great news! <strong>${chargerName}</strong> is now available and ready for you to plug in your vehicle.
          </p>
          <p style="font-size: 16px; margin-bottom: 0;">
            Please head to the charging station and plug in your car. You have <strong>5 minutes</strong> to respond before your spot is moved to the next person in line.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from the EV Charging Station system.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({ to: userEmail, subject, html });
  }

  /**
   * Send notification when charging is almost complete (2 minutes remaining)
   */
  static async sendChargingAlmostCompleteNotification(
    userEmail: string,
    userName: string,
    chargerName: string,
    minutesRemaining: number
  ): Promise<void> {
    const subject = "⚡ Charging Almost Complete - Please Prepare";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">EV Charging Station</h1>
        </div>
        
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #d97706; margin-top: 0;">Charging Almost Complete</h2>
          <p style="font-size: 16px; margin-bottom: 10px;">Hi ${userName},</p>
          <p style="font-size: 16px; margin-bottom: 15px;">
            Your vehicle at <strong>${chargerName}</strong> has approximately <strong>${minutesRemaining} minutes</strong> of charging time remaining.
          </p>
          <p style="font-size: 16px; margin-bottom: 0;">
            Please prepare to unplug your vehicle soon. Other users may be waiting in the queue.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from the EV Charging Station system.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({ to: userEmail, subject, html });
  }

  /**
   * Send notification when charging time has expired (overtime)
   */
  static async sendChargingExpiredNotification(
    userEmail: string,
    userName: string,
    chargerName: string,
    overtimeMinutes: number
  ): Promise<void> {
    const subject = "🚨 Charging Time Expired - Please Move Your Vehicle";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">EV Charging Station</h1>
        </div>
        
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #dc2626; margin-top: 0;">⚠️ Charging Time Expired</h2>
          <p style="font-size: 16px; margin-bottom: 10px;">Hi ${userName},</p>
          <p style="font-size: 16px; margin-bottom: 15px;">
            Your allocated charging time at <strong>${chargerName}</strong> has expired. ${
      overtimeMinutes > 0
        ? `You are currently <strong>${overtimeMinutes} minutes</strong> over your scheduled time.`
        : ""
    }
          </p>
          <p style="font-size: 16px; margin-bottom: 15px; color: #dc2626;">
            <strong>Please unplug and move your vehicle immediately.</strong>
          </p>
          <p style="font-size: 16px; margin-bottom: 0;">
            Other users are waiting in the queue. Thank you for your cooperation.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from the EV Charging Station system.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({ to: userEmail, subject, html });
  }

  /**
   * Send notification when user successfully completes charging
   */
  static async sendChargingCompleteNotification(
    userEmail: string,
    userName: string,
    chargerName: string,
    chargingDurationMinutes: number
  ): Promise<void> {
    const subject = "✅ Charging Session Complete - Thank You!";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">EV Charging Station</h1>
        </div>
        
        <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #16a34a; margin-top: 0;">Charging Complete!</h2>
          <p style="font-size: 16px; margin-bottom: 10px;">Hi ${userName},</p>
          <p style="font-size: 16px; margin-bottom: 15px;">
            Your charging session at <strong>${chargerName}</strong> has been completed successfully.
          </p>
          <p style="font-size: 16px; margin-bottom: 15px;">
            <strong>Session Duration:</strong> ${Math.floor(
              chargingDurationMinutes / 60
            )}h ${chargingDurationMinutes % 60}m
          </p>
          <p style="font-size: 16px; margin-bottom: 0;">
            Thank you for using our EV charging station responsibly!
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #6b7280; font-size: 14px;">
            This is an automated notification from the EV Charging Station system.
          </p>
        </div>
      </div>
    `;

    await this.sendEmail({ to: userEmail, subject, html });
  }

  /**
   * Test email functionality
   */
  static async sendTestEmail(
    testEmail: string = "test@example.com"
  ): Promise<void> {
    const subject = "🧪 EV Charging Station - Email Test";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">EV Charging Station</h1>
        </div>
        
        <div style="background-color: #f0f9ff; border-left: 4px solid #2563eb; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #1e40af; margin-top: 0;">Email Test Successful! 🎉</h2>
          <p style="font-size: 16px; margin-bottom: 15px;">
            This is a test email to verify that the email notification system is working correctly.
          </p>
          <p style="font-size: 16px; margin-bottom: 15px;">
            <strong>Sent at:</strong> ${new Date().toLocaleString()}
          </p>
          <p style="font-size: 16px; margin-bottom: 0;">
            If you can see this email, the notification system is ready to go!
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #6b7280; font-size: 14px;">
            This is a test email from the EV Charging Station system.
          </p>
        </div>
      </div>
    `;

    console.log("🧪 Sending test email...");
    await this.sendEmail({ to: testEmail, subject, html });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    name?: string
  ): Promise<void> {
    const subject = "Password Reset Instructions";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width:600px;margin:0 auto;">
        <h1 style="color:#2563eb;">EV Charging Station</h1>
        <p>Hi${name ? ` ${name}` : ""},</p>
        <p>You requested to reset your password. Click the button below to proceed. This link is valid for 60 minutes.</p>
        <p style="text-align:center; margin:32px 0;">
          <a href="${resetLink}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;">Reset Password</a>
        </p>
        <p>If you did not request this, you can ignore this email.</p>
        <p style="color:#6b7280;font-size:12px">This is an automated message.</p>
      </div>`;

    await this.sendEmail({ to, subject, html });
  }
}
