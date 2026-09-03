// services/judge.service.js
const salesforceService = require("./salesforce.service");

const RESULT_START = "APEXJUDGE_RESULTS_START";
const RESULT_END = "APEXJUDGE_RESULTS_END";

const FORBIDDEN_PATTERNS = [
  /@future/i,
  /\bDatabase\.executeBatch\b/,
  /\bimplements\s+Database\.Batchable\b/,
  /\bSystem\.schedule\s*\(/,
  /\bimplements\s+Schedulable\b/,
  /\bMessaging\.sendEmail\b/,
  /\bHttp\s*\(\s*\)/,
  /\bimplements\s+Queueable\b/,
  /\bSystem\.enqueueJob\s*\(/,
];

function escapeApexString(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function assertSafeCode(userCode) {
  const hit = FORBIDDEN_PATTERNS.find((re) => re.test(userCode));
  if (hit) {
    const err = new Error(
      "This code uses a feature that isn't allowed here (async jobs, callouts, or emails). Practice problems run synchronously only.",
    );
    err.statusCode = 400;
    throw err;
  }
}

// User code goes first with nothing prepended, so any compile error's
// line/column maps 1:1 onto what the solver actually typed.
function buildHarness(problem, userCode) {
  const lines = [];
  lines.push("Savepoint apexJudgeSavepoint = Database.setSavepoint();");
  lines.push("List<Map<String,Object>> apexJudgeResults = new List<Map<String,Object>>();");
  lines.push(`${problem.className} solution = new ${problem.className}();`);

  problem.testCases.forEach((tc, idx) => {
    const v = `apexJudgeCase${idx}`;
    lines.push(`Map<String,Object> ${v} = new Map<String,Object>();`);
    lines.push(`${v}.put('label', '${escapeApexString(tc.label)}');`);
    lines.push("try {");
    lines.push(`    Object apexJudgeActual = (Object)(${tc.invocation});`);
    lines.push(`    Object apexJudgeExpected = (Object)(${tc.expected});`);
    lines.push(`    ${v}.put('actual', apexJudgeActual);`);
    lines.push(`    ${v}.put('passed', apexJudgeActual == apexJudgeExpected);`);
    lines.push("} catch (Exception apexJudgeEx) {");
    lines.push(`    ${v}.put('passed', false);`);
    lines.push(`    ${v}.put('error', apexJudgeEx.getMessage());`);
    lines.push("}");
    lines.push(`apexJudgeResults.add(${v});`);
  });

  lines.push("Database.rollback(apexJudgeSavepoint);");
  lines.push(`System.debug('${RESULT_START}' + JSON.serialize(apexJudgeResults) + '${RESULT_END}');`);

  return `${userCode}\n\n${lines.join("\n")}`;
}

function extractResults(debugLog) {
  const start = debugLog.indexOf(RESULT_START);
  const end = debugLog.indexOf(RESULT_END);
  if (start === -1 || end === -1) return null;
  const json = debugLog.slice(start + RESULT_START.length, end);
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function gradeSubmission({ problem, userCode, instanceUrl, accessToken }) {
  assertSafeCode(userCode);

  const harness = buildHarness(problem, userCode);
  const start = Date.now();
  const result = await salesforceService.executeAnonymous(instanceUrl, accessToken, harness);
  const runtimeMs = Date.now() - start;

  if (!result.compiled) {
    return {
      outcome: "compile_error",
      compileError: {
        line: result.line,
        column: result.column,
        message: result.compileProblem,
      },
      runtimeMs,
    };
  }

  if (!result.success) {
    return {
      outcome: "runtime_error",
      runtimeError: {
        message: result.exceptionMessage,
        stackTrace: result.exceptionStackTrace,
      },
      runtimeMs,
    };
  }

  const results = extractResults(result.debugLog) || [];
  const passedCount = results.filter((r) => r.passed).length;

  return {
    outcome: "graded",
    results,
    passedCount,
    totalCount: problem.testCases.length,
    allPassed: passedCount === problem.testCases.length && results.length === problem.testCases.length,
    runtimeMs,
  };
}

module.exports = { buildHarness, gradeSubmission };
