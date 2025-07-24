import nodemailer from "nodemailer";

// Email configuration - you'll want to set these in environment variables
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || "", // your email
    pass: process.env.SMTP_PASS || "", // your app password
  },
};

const transporter = nodemailer.createTransport(EMAIL_CONFIG);

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  /**
   * Send an email notification
   */
  static async sendEmail(options: EmailOptions): Promise<void> {
    try {
      if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
        console.warn("Email credentials not configured, skipping email send");
        return;
      }

      const mailOptions = {
        from: `"EV Charging Station" <${EMAIL_CONFIG.auth.user}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      };

      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully:", info.messageId);
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

    await this.sendEmail({
      to: userEmail,
      subject,
      html,
    });
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

    await this.sendEmail({
      to: userEmail,
      subject,
      html,
    });
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
            Your allocated charging time at <strong>${chargerName}</strong> has expired. 
            ${
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

    await this.sendEmail({
      to: userEmail,
      subject,
      html,
    });
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

    await this.sendEmail({
      to: userEmail,
      subject,
      html,
    });
  }
}
