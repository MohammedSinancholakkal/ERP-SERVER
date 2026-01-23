const nodemailer = require("nodemailer");

const sendEmail = async (to, subject, html) => {
  try {
    console.log(`[EMAIL SERVICE] Attempting to send email...`);
    console.log(`[EMAIL SERVICE] To: ${Array.isArray(to) ? to.join(', ') : to}`);
    console.log(`[EMAIL SERVICE] Subject: ${subject}`);
    
    // Check credentials
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("EMAIL_USER or EMAIL_PASS environment variables not set");
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const result = await transporter.sendMail({
      from: `"HomeButton ERP" <${process.env.EMAIL_USER}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    console.log(`[EMAIL SERVICE] ✅ Email sent successfully! Message ID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error(`[EMAIL SERVICE] ❌ Failed to send email:`, error.message);
    throw error;
  }
};

module.exports = sendEmail;
