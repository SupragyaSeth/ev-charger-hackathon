// Test script for email service using CommonJS
const nodemailer = require("nodemailer");

// Email configuration - using Ethereal test account for development
const EMAIL_CONFIG = {
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: "bert.dubuque19@ethereal.email",
    pass: "ycxyAFDCNT6KmeEa8P",
  },
};

async function testEmailService() {
  console.log("Testing email service with Ethereal...");

  try {
    // Create transporter
    const transporter = nodemailer.createTransport(EMAIL_CONFIG);

    // Test email options
    const mailOptions = {
      from: '"EV Charging Station" <bert.dubuque19@ethereal.email>',
      to: "test-recipient@example.com",
      subject: "EV Charging Station - Email Test",
      html: `
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
      `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully!");
    console.log(`� Message ID: ${info.messageId}`);

    // Get preview URL for Ethereal
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`\n🔗 Preview email at: ${previewUrl}`);
      console.log(
        "\nCopy and paste the URL above into your browser to view the email!"
      );
    }

    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Email test failed:", error);
  }
}

testEmailService();
