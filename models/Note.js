// models/Note.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const NotesSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true, // Make sure a user is always associated
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    tag: {
      // Keep tag for specific keywords if desired
      type: String,
      default: "General",
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", // References the Category model
      required: [true, "A category is required for each note."],
      index: true, // Good for filtering by category
    },
    date: {
      type: Date,
      default: Date.now,
    },
    readTimeMinutes: {
      type: Number,
      required: false, // Or calculate automatically before save
      min: [0, "Read time cannot be negative"],
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// Optional: Add index for combined user and category filtering if common
// NotesSchema.index({ user: 1, category: 1 });

// Optional: Middleware to calculate read time before saving
NotesSchema.pre("save", function (next) {
  if (this.isModified("description") || this.isNew) {
    const words = this.description.split(/\s+/).filter(Boolean).length;
    const wordsPerMinute = 200;
    this.readTimeMinutes = Math.max(1, Math.ceil(words / wordsPerMinute));
  }
  next();
});

module.exports = mongoose.model("notes", NotesSchema); // Keep model name 'notes' if desired
