// One-off, idempotent seed script for hand-authored ApexJudge problems.
// Run with: node scripts/seed-problems.js
require("dotenv").config({ path: "../config.env" });
const mongoose = require("mongoose");
const config = require("../config/index");
const Problem = require("../models/Problem");

const problems = [
  {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    tags: ["Arrays", "Apex"],
    statementMd: `Given a list of integers \`nums\` and an integer \`target\`, return the indices of the
two numbers that add up to \`target\`, as a \`List<Integer>\` with the lower index first.

You may assume each input has exactly one solution, and you may not use the same
element twice.

**Example**

\`\`\`
Input: nums = [2, 7, 11, 15], target = 9
Output: [0, 1]
Explanation: nums[0] + nums[1] == 9
\`\`\``,
    className: "Solution",
    starterCode: `public class Solution {
    public List<Integer> twoSum(List<Integer> nums, Integer target) {
        // Return the indices of the two numbers that add up to target.
        return new List<Integer>();
    }
}`,
    testCases: [
      {
        label: "example_pair_found",
        invocation: "solution.twoSum(new List<Integer>{2, 7, 11, 15}, 9)",
        expected: "new List<Integer>{0, 1}",
        isSample: true,
      },
      {
        label: "negative_numbers",
        invocation: "solution.twoSum(new List<Integer>{-3, 4, 3, 90}, 0)",
        expected: "new List<Integer>{0, 2}",
        isSample: true,
      },
      {
        label: "pair_at_end",
        invocation: "solution.twoSum(new List<Integer>{1, 2, 3, 4, 5}, 9)",
        expected: "new List<Integer>{3, 4}",
        isSample: false,
      },
      {
        label: "duplicate_values",
        invocation: "solution.twoSum(new List<Integer>{3, 3}, 6)",
        expected: "new List<Integer>{0, 1}",
        isSample: false,
      },
    ],
    status: "published",
  },
];

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to Mongo");

  for (const p of problems) {
    await Problem.findOneAndUpdate({ slug: p.slug }, p, { upsert: true, new: true, setDefaultsOnInsert: true });
    console.log(`Seeded problem: ${p.slug}`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
