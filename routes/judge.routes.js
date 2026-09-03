const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchuser");
const judgeController = require("../controllers/judge.controller");

// GET /api/judge/salesforce/connect
router.get("/salesforce/connect", fetchuser, judgeController.connect);

// GET /api/judge/oauth/callback — must match SALESFORCE_CALLBACK_URL and the
// Callback URL registered on the External Client App, not /salesforce/callback
router.get("/oauth/callback", judgeController.callback);

// GET /api/judge/salesforce/orgs
router.get("/salesforce/orgs", fetchuser, judgeController.listOrgs);

// GET /api/judge/problems
router.get("/problems", judgeController.listProblems);

// GET /api/judge/problems/:slug
router.get("/problems/:slug", judgeController.getProblem);

// POST /api/judge/submit
router.post("/submit", fetchuser, judgeController.submit);

module.exports = router;
