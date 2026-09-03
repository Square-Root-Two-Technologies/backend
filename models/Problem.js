// models/Problem.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const TestCaseSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    // Apex expressions, written by the problem author — e.g. "solution.addNumbers(2, 3)" / "5"
    invocation: { type: String, required: true },
    expected: { type: String, required: true },
    isSample: { type: Boolean, default: false },
  },
  { _id: false },
);

const ProblemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, index: true },
    difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
    tags: [{ type: String, trim: true }],
    statementMd: { type: String, required: true },
    // Class the solver edits inside; instance methods only — anonymous Apex can't run static methods on inline classes
    className: { type: String, default: "Solution", trim: true },
    starterCode: { type: String, required: true },
    testCases: {
      type: [TestCaseSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "A problem needs at least one test case.",
      },
    },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Problem", ProblemSchema);
