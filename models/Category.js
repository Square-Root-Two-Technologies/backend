// FILE: models/Category.js
const mongoose = require("mongoose");
const { Schema } = mongoose;
// REMOVE: const slugify = require("slugify");

const CategorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required."],
      trim: true,
      minlength: [2, "Category name must be at least 2 characters long."],
      maxlength: [50, "Category name cannot exceed 50 characters."],
    },
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters."],
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

// Ensure uniqueness based on name within the same parent category
CategorySchema.index({ parent: 1, name: 1 }, { unique: true });

const Category = mongoose.model("Category", CategorySchema);
module.exports = Category;
