// models/Submission.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const TestCaseResultSchema = new Schema(
  {
    label: String,
    passed: Boolean,
    actual: Schema.Types.Mixed,
    error: String,
  },
  { _id: false },
);

const SubmissionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
    problem: { type: Schema.Types.ObjectId, ref: "Problem", required: true, index: true },
    salesforceOrg: { type: Schema.Types.ObjectId, ref: "SalesforceOrg", required: true },
    source: { type: String, required: true },
    outcome: {
      type: String,
      enum: ["compile_error", "runtime_error", "graded"],
      required: true,
    },
    compileError: {
      line: Number,
      column: Number,
      message: String,
    },
    runtimeError: {
      message: String,
      stackTrace: String,
    },
    results: [TestCaseResultSchema],
    passedCount: { type: Number, default: 0 },
    totalCount: { type: Number, default: 0 },
    allPassed: { type: Boolean, default: false },
    runtimeMs: Number,
  },
  { timestamps: true },
);

SubmissionSchema.index({ user: 1, problem: 1, createdAt: -1 });

module.exports = mongoose.model("Submission", SubmissionSchema);
