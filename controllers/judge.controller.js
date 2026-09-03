const jwt = require("jsonwebtoken");
const config = require("../config/index");
const salesforceService = require("../services/salesforce.service");
const judgeService = require("../services/judge.service");
const cryptoUtil = require("../services/crypto.util");
const Problem = require("../models/Problem");
const SalesforceOrg = require("../models/SalesforceOrg");
const Submission = require("../models/Submission");

// GET /api/judge/salesforce/connect
async function connect(req, res) {
  try {
    const { codeVerifier, codeChallenge } = salesforceService.generatePkcePair();
    const state = jwt.sign({ userId: req.user.id, codeVerifier }, config.jwtSecret, { expiresIn: "10m" });
    const authorizeUrl = salesforceService.buildAuthorizeUrl(state, codeChallenge);
    res.json({ success: true, authorizeUrl });
  } catch (err) {
    console.error("Error building Salesforce authorize URL:", err.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

// GET /api/judge/oauth/callback — Salesforce redirects here, no auth-token header available
async function callback(req, res) {
  const { code, state, error: sfError } = req.query;
  const fail = (message) =>
    res.redirect(`${config.frontendUrl}/apexjudge/connect?error=${encodeURIComponent(message)}`);

  if (sfError) return fail(sfError);
  if (!code || !state) return fail("Missing authorization code");

  let userId, codeVerifier;
  try {
    ({ userId, codeVerifier } = jwt.verify(state, config.jwtSecret));
  } catch {
    return fail("Your connection attempt expired. Please try again.");
  }

  try {
    const token = await salesforceService.exchangeCodeForToken(code, codeVerifier);
    const identity = await salesforceService.getIdentity(token.id, token.access_token);
    const orgInfo = await salesforceService.getOrgInfo(token.instance_url, token.access_token);

    if (!orgInfo.isSandbox && orgInfo.organizationType === "Production") {
      return fail("Production orgs aren't supported here — connect a Developer Edition or sandbox org.");
    }

    const orgType = orgInfo.isSandbox
      ? "sandbox"
      : (orgInfo.organizationType || "").includes("Developer")
        ? "developer"
        : "other";

    await SalesforceOrg.findOneAndUpdate(
      { user: userId, sfOrgId: identity.organization_id },
      {
        user: userId,
        sfOrgId: identity.organization_id,
        sfUserId: identity.user_id,
        username: identity.username,
        instanceUrl: token.instance_url,
        orgType,
        accessToken: cryptoUtil.encrypt(token.access_token),
        refreshToken: token.refresh_token ? cryptoUtil.encrypt(token.refresh_token) : undefined,
        tokenIssuedAt: new Date(),
        status: "active",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.redirect(`${config.frontendUrl}/apexjudge/connect?connected=1`);
  } catch (err) {
    console.error("Error in Salesforce OAuth callback:", err.message);
    fail("Could not connect to Salesforce. Please try again.");
  }
}

// GET /api/judge/salesforce/orgs
async function listOrgs(req, res) {
  try {
    const orgs = await SalesforceOrg.find({ user: req.user.id, status: "active" }).sort({ createdAt: -1 });
    res.json({ success: true, orgs });
  } catch (err) {
    console.error("Error listing Salesforce orgs:", err.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

// GET /api/judge/problems
async function listProblems(req, res) {
  try {
    const problems = await Problem.find({ status: "published" })
      .select("title slug difficulty tags")
      .sort({ createdAt: 1 });
    res.json({ success: true, problems });
  } catch (err) {
    console.error("Error listing problems:", err.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

// GET /api/judge/problems/:slug — hidden test cases are stripped down to just their label
async function getProblem(req, res) {
  try {
    const problem = await Problem.findOne({ slug: req.params.slug, status: "published" }).lean();
    if (!problem) {
      return res.status(404).json({ success: false, error: "Problem not found" });
    }
    problem.testCases = problem.testCases.map((tc) =>
      tc.isSample ? tc : { label: tc.label, isSample: false },
    );
    res.json({ success: true, problem });
  } catch (err) {
    console.error("Error fetching problem:", err.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

// POST /api/judge/submit
async function submit(req, res) {
  const { problemSlug, code, salesforceOrgId } = req.body;
  if (!problemSlug || !code || !salesforceOrgId) {
    return res.status(400).json({
      success: false,
      error: "problemSlug, code, and salesforceOrgId are required",
    });
  }

  try {
    const problem = await Problem.findOne({ slug: problemSlug, status: "published" });
    if (!problem) {
      return res.status(404).json({ success: false, error: "Problem not found" });
    }

    const org = await SalesforceOrg.findOne({
      _id: salesforceOrgId,
      user: req.user.id,
      status: "active",
    }).select("+accessToken +refreshToken");
    if (!org) {
      return res.status(404).json({ success: false, error: "Connected org not found" });
    }

    const accessToken = cryptoUtil.decrypt(org.accessToken);
    let gradeResult;
    try {
      gradeResult = await judgeService.gradeSubmission({
        problem,
        userCode: code,
        instanceUrl: org.instanceUrl,
        accessToken,
      });
    } catch (err) {
      if (err.statusCode === 401 && org.refreshToken) {
        const refreshed = await salesforceService.refreshAccessToken(cryptoUtil.decrypt(org.refreshToken));
        org.accessToken = cryptoUtil.encrypt(refreshed.access_token);
        await org.save();
        gradeResult = await judgeService.gradeSubmission({
          problem,
          userCode: code,
          instanceUrl: org.instanceUrl,
          accessToken: refreshed.access_token,
        });
      } else {
        throw err;
      }
    }

    const submission = await Submission.create({
      user: req.user.id,
      problem: problem._id,
      salesforceOrg: org._id,
      source: code,
      ...gradeResult,
    });

    res.json({ success: true, submission });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error("Error grading submission:", err.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

module.exports = { connect, callback, listOrgs, listProblems, getProblem, submit };
