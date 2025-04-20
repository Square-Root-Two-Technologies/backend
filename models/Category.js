const mongoose = require("mongoose");
const { Schema } = mongoose;

const CategorySchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    default: null, // Top-level categories have no parent
  },
  slug: {
    type: String,
    required: true,
    unique: true, // For SEO-friendly URLs
  },
  description: {
    type: String,
  },
});

// Ensure uniqueness of category names at the same level
CategorySchema.index({ parent: 1, name: 1 }, { unique: true });

const Category = mongoose.model("Category", CategorySchema);
