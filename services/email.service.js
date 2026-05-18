// Extracted from automation/scheduler.js — Mailjet/Nodemailer transporter and send logic.
// scheduler.js continues to use its own self-contained transporter; this module is
// provided for any future direct use of email sending outside the cron job.
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAILJET_HOST || "in-v3.mailjet.com",
  port: parseInt(process.env.MAILJET_PORT || "587", 10),
  secure: (process.env.MAILJET_PORT || "587") === "465",
  auth: {
    user: process.env.MAILJET_API_KEY,
    pass: process.env.MAILJET_SECRET_KEY,
  },
});

/**
 * Send a generic email.
 * @param {{ from: string, to: string, subject: string, html: string }} mailOptions
 */
async function sendMail(mailOptions) {
  return transporter.sendMail(mailOptions);
}

module.exports = { transporter, sendMail };
