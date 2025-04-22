// scheduler.js
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const User = require("../models/User"); // Adjust path if needed
const ConsultationRequest = require("../models/ConsultationRequest"); // Adjust path if needed
require("dotenv").config({ path: "./config.env" }); // Ensure env vars are loaded

// --- Nodemailer Setup (Copied from index.js, now self-contained) ---
// IMPORTANT: Ensure Mailjet env variables are set in config.env
const transporter = nodemailer.createTransport({
  host: process.env.MAILJET_HOST || "in-v3.mailjet.com",
  port: parseInt(process.env.MAILJET_PORT || "587", 10),
  secure: (process.env.MAILJET_PORT || "587") === "465",
  auth: {
    user: process.env.MAILJET_API_KEY, // Your Mailjet API Key
    pass: process.env.MAILJET_SECRET_KEY, // Your Mailjet Secret Key
  },
});

// Optional: Verify transporter config on startup (can be useful for debugging)
transporter.verify(function (error, success) {
  if (error) {
    console.error("[Scheduler] Nodemailer configuration error:", error);
  } else {
    console.log("[Scheduler] Nodemailer transporter verified successfully.");
  }
});

// --- Define the Hourly Job Function ---
const sendHourlyConsultationSummary = async () => {
  console.log(
    `[${new Date().toISOString()}] Running hourly consultation request email job...`,
  );
  try {
    // 1. Find requests not yet emailed
    const newRequests = await ConsultationRequest.find({
      emailedInBatch: false,
    }).sort({ createdAt: 1 });

    if (newRequests.length === 0) {
      console.log("[Scheduler] No new consultation requests to email.");
      return;
    }

    console.log(`[Scheduler] Found ${newRequests.length} new request(s).`);

    // 2. Find SuperAdmin emails
    const superAdmins = await User.find({ role: "SuperAdmin" }).select("email");
    const adminEmails = superAdmins.map((admin) => admin.email);

    if (adminEmails.length === 0) {
      console.warn(
        "[Scheduler] No SuperAdmin users found. Cannot send batch email.",
      );
      return; // Don't mark as emailed if not sent
    }

    console.log(
      `[Scheduler] Sending batch email to: ${adminEmails.join(", ")}`,
    );

    // 3. Format the email content
    let emailHtml = `<h1>Hourly Consultation Requests Summary</h1>`;
    emailHtml += `<p>Received ${newRequests.length} new request(s) since the last summary:</p>`; // Adjusted wording
    emailHtml += "<ul>";
    newRequests.forEach((req) => {
      emailHtml += `
              <li style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                  <strong>Name:</strong> ${req.name}<br/>
                  <strong>Email:</strong> ${req.email}<br/>
                  ${
                    req.company
                      ? `<strong>Company:</strong> ${req.company}<br/>`
                      : ""
                  }
                  <strong>Received:</strong> ${req.createdAt.toLocaleString(
                    "en-IN",
                    { timeZone: "Asia/Kolkata" },
                  )}<br/>
                  <strong>Message:</strong><br/>
                  <p style="white-space: pre-wrap; background-color: #f9f9f9; padding: 5px;">${
                    req.message
                  }</p>
              </li>
          `;
    });
    emailHtml += "</ul>";
    emailHtml += `<p>Please log in to the dashboard to manage these requests.</p>`;

    // 4. Send the email
    const mailOptions = {
      from: `"Website Notifications" <${process.env.MAILJET_SENDER_EMAIL}>`,
      to: adminEmails.join(", "),
      subject: `[${newRequests.length}] New Consultation Request(s) - Hourly Summary`,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log("[Scheduler] Batch email sent successfully.");

    // 5. Update the requests to mark them as emailed
    const requestIds = newRequests.map((req) => req._id);
    await ConsultationRequest.updateMany(
      { _id: { $in: requestIds } },
      { $set: { emailedInBatch: true } },
    );
    console.log(`[Scheduler] Marked ${requestIds.length} requests as emailed.`);
  } catch (error) {
    console.error("[Scheduler] Hourly job error:", error);
    // Consider adding more robust error logging/alerting here
  }
};

// --- Function to Start All Scheduled Jobs ---
const startScheduledJobs = () => {
  // Schedule the hourly job
  cron.schedule(
    "0 * * * *", // Run at the beginning of every hour
    sendHourlyConsultationSummary,
    {
      scheduled: true,
      timezone: "Asia/Kolkata", // Set to your server's or target timezone
    },
  );

  console.log("[Scheduler] Hourly consultation summary job scheduled.");

  // Add other cron jobs here if needed in the future
};

module.exports = { startScheduledJobs }; // Export the function that starts the jobs
