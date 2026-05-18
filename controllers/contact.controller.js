const { validationResult } = require("express-validator");
const contactService = require("../services/contact.service");

async function submit(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { name, email, company, message } = req.body;
    await contactService.saveRequest({ name, email, company, message });
    res.status(201).json({
      success: true,
      message: "Thank you for your request! We will get back to you soon.",
    });
  } catch (error) {
    console.error("Error saving consultation request:", error);
    res.status(500).json({ success: false, error: "Server error processing your request." });
  }
}

async function getRequests(req, res) {
  try {
    const requests = await contactService.listRequests();
    res.json({ success: true, requests });
  } catch (error) {
    console.error("Error fetching consultation requests for admin:", error);
    res.status(500).json({ success: false, error: "Server error fetching requests." });
  }
}

module.exports = { submit, getRequests };
