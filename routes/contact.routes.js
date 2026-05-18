const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const fetchuser = require("../middleware/fetchuser");
const isSuperAdmin = require("../middleware/isSuperAdmin");
const contactController = require("../controllers/contact.controller");

// POST /api/contact/submit
router.post(
  "/submit",
  [
    body("name", "Name is required and must be at least 2 characters").trim().isLength({ min: 2 }),
    body("email", "Please enter a valid email address").trim().isEmail(),
    body("company").optional().trim(),
    body("message", "Message is required and must be at least 10 characters")
      .trim()
      .isLength({ min: 10 }),
  ],
  contactController.submit,
);

// GET /api/contact/requests — SuperAdmin only
router.get("/requests", fetchuser, isSuperAdmin, contactController.getRequests);

module.exports = router;
