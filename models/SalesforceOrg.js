// models/SalesforceOrg.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const SalesforceOrgSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "user", required: true, index: true },
    sfOrgId: { type: String, required: true },
    sfUserId: { type: String, required: true },
    username: { type: String, required: true, trim: true },
    instanceUrl: { type: String, required: true },
    orgType: {
      type: String,
      enum: ["developer", "sandbox", "production", "other"],
      default: "developer",
    },
    // Encrypted at rest — see services/crypto.util.js. Never returned by default.
    accessToken: { type: String, required: true, select: false },
    refreshToken: { type: String, select: false },
    tokenIssuedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["active", "revoked", "error"], default: "active" },
  },
  { timestamps: true },
);

SalesforceOrgSchema.index({ user: 1, sfOrgId: 1 }, { unique: true });

module.exports = mongoose.model("SalesforceOrg", SalesforceOrgSchema);
