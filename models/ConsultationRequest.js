// models/ConsultationRequest.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const consultationRequestSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      trim: true,
      lowercase: true,
      // Basic email format validation (consider a more robust library if needed)
      match: [/\S+@\S+\.\S+/, "Please enter a valid email address."],
    },
    company: {
      type: String,
      trim: true,
      default: null, // Explicitly null if not provided
    },
    message: {
      type: String,
      required: [true, "Message is required."],
      trim: true,
      minlength: 10, // Add a minimum length for the message
    },
    status: {
      type: String,
      enum: ["New", "Contacted", "Closed", "Archived"],
      default: "New",
      index: true,
    },
    emailedInBatch: {
      // Flag to track if included in the hourly email
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  },
);

const ConsultationRequest = mongoose.model(
  "ConsultationRequest",
  consultationRequestSchema,
);

module.exports = ConsultationRequest;
