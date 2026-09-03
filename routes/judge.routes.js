const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchuser");
const judgeController = require("../controllers/judge.controller");

// GET /api/judge/salesforce/connect
router.get("/salesforce/connect", fetchuser, judgeController.connect);

// GET /api/judge/salesforce/callback — Salesforce redirects here directly, no auth-token header
router.get("/salesforce/callback", judgeController.callback);

// GET /api/judge/salesforce/orgs
router.get("/salesforce/orgs", fetchuser, judgeController.listOrgs);

// GET /api/judge/problems
router.get("/problems", judgeController.listProblems);

// GET /api/judge/problems/:slug
router.get("/problems/:slug", judgeController.getProblem);

// POST /api/judge/submit
router.post("/submit", fetchuser, judgeController.submit);

module.exports = router;
