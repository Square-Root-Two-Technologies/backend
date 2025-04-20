// FILE: models/Note.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const NotesSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  tag: {
    type: String,
    default: "General",
  },
  type: {
    type: String,
    enum: [
      "JavaScript",
      "Salesforce",
      "Sociology",
      "Life",
      "Technology",
      "Creative",
      "Tutorial",
      "News",
    ],
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  readTimeMinutes: {
    type: Number,
    required: false, // Keep this if you still calculate/use it
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true, // Ensures slugs are unique across all notes
    index: true, // Improves database query performance when finding by slug
  },
});

module.exports = mongoose.model("notes", NotesSchema);
