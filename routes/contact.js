// routes/contact.js
const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const ConsultationRequest = require("../models/ConsultationRequest");
const fetchuser = require("../middleware/fetchuser"); // To identify user making request
const isSuperAdmin = require("../middleware/isSuperAdmin"); // To restrict access

// --- Endpoint for Landing Page Form Submission ---
router.post(
  "/submit",
  [
    // Validation rules
    body("name", "Name is required and must be at least 2 characters")
      .trim()
      .isLength({ min: 2 }),
    body("email", "Please enter a valid email address").trim().isEmail(),
    body("company").optional().trim(),
    body("message", "Message is required and must be at least 10 characters")
      .trim()
      .isLength({ min: 10 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, email, company, message } = req.body;

      const newRequest = new ConsultationRequest({
        name,
        email,
        company: company || null, // Store null if empty
        message,
        status: "New", // Default status
        emailedInBatch: false, // Not yet emailed
      });

      await newRequest.save();

      console.log(`New consultation request received from: ${email}`);

      // Respond to the frontend - NO email sent here
      res.status(201).json({
        success: true,
        message: "Thank you for your request! We will get back to you soon.",
      });
    } catch (error) {
      console.error("Error saving consultation request:", error);
      res.status(500).json({
        success: false,
        error: "Server error processing your request.",
      });
    }
  },
);

// --- Endpoint for SuperAdmins to View All Requests ---
router.get(
  "/requests",
  fetchuser, // Ensure user is logged in
  isSuperAdmin, // Ensure user is SuperAdmin
  async (req, res) => {
    try {
      // Fetch all requests, sort by newest first
      const requests = await ConsultationRequest.find({}).sort({
        createdAt: -1,
      }); // Sort by creation date, newest first

      res.json({ success: true, requests });
    } catch (error) {
      console.error("Error fetching consultation requests for admin:", error);
      res
        .status(500)
        .json({ success: false, error: "Server error fetching requests." });
    }
  },
);

// --- (Optional Future Endpoint for SuperAdmin to Update Status) ---
/*
router.put(
    '/requests/:id/status',
    fetchuser,
    isSuperAdmin,
    [
        body('status', 'Invalid status value').isIn(['New', 'Contacted', 'Closed', 'Archived'])
    ],
    async (req, res) => {
        // ... implementation to find request by id and update status ...
    }
);
*/

module.exports = router;
