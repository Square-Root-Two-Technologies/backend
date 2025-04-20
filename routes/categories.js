// FILE: routes/categories.js
const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const Note = require("../models/Note");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchuser");
const isAdmin = require("../middleware/isAdmin");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");

// GET all categories (No change needed here)
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ parent: 1, name: 1 })
      .lean();
    res.json({ success: true, categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res
      .status(500)
      .json({ success: false, error: "Server Error fetching categories" });
  }
});

// GET category tree (No change needed here)
router.get("/tree", async (req, res) => {
  // ... route content (no changes related to slug removal needed)
  try {
    const allCategories = await Category.find().sort({ name: 1 }).lean();
    const categoryMap = {};
    const categoryTree = [];
    allCategories.forEach((category) => {
      // Add _id and name to the map, slug is no longer relevant here
      categoryMap[category._id.toString()] = { ...category, children: [] };
    });
    allCategories.forEach((category) => {
      const categoryNode = categoryMap[category._id.toString()];
      if (category.parent && categoryMap[category.parent.toString()]) {
        categoryMap[category.parent.toString()].children.push(categoryNode);
      } else {
        categoryTree.push(categoryNode);
      }
    });
    res.json({ success: true, categoryTree });
  } catch (error) {
    console.error("Error fetching category tree:", error);
    res
      .status(500)
      .json({ success: false, error: "Server Error fetching category tree" });
  }
});

// --- MODIFY GET SINGLE CATEGORY ROUTE ---
// Change route parameter from :idOrSlug to :id
router.get("/:id", async (req, res) => {
  try {
    // Get ID directly from params
    const categoryId = req.params.id;

    // Validate if it's a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid Category ID format" });
    }

    // Find only by ID, remove slug population from parent
    const category = await Category.findById(categoryId).populate(
      "parent",
      "name",
    ); // Removed slug

    if (!category) {
      return res
        .status(404)
        .json({ success: false, error: "Category not found" });
    }

    // Return the category (slug will not be present)
    res.json({ success: true, category });
  } catch (error) {
    console.error("Error fetching single category:", error);
    res
      .status(500)
      .json({ success: false, error: "Server Error fetching category" });
  }
});
// --- END OF MODIFICATION ---

// --- MODIFY POST (CREATE) CATEGORY ROUTE ---
router.post(
  "/",
  fetchuser,
  isAdmin,
  [
    // Validation rules remain the same for name, parent, description
    body("name", "Category name is required and must be 2-50 characters")
      .trim()
      .isLength({ min: 2, max: 50 }),
    body("parent")
      .optional({ values: "falsy" })
      .if(body("parent").notEmpty())
      .isMongoId()
      .withMessage("Invalid parent category ID"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Description cannot exceed 200 characters"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
      const { name, description } = req.body;
      const parentId =
        req.body.parent && mongoose.Types.ObjectId.isValid(req.body.parent)
          ? req.body.parent
          : null;

      if (parentId) {
        const parentCategory = await Category.findById(parentId);
        if (!parentCategory) {
          return res.status(400).json({
            success: false,
            errors: [{ msg: "Parent category not found", param: "parent" }],
          });
        }
      }

      // Create new category - slug is no longer part of the schema or auto-generated
      const newCategory = new Category({
        name,
        parent: parentId,
        description,
      });

      await newCategory.save();
      res.status(201).json({ success: true, category: newCategory });
    } catch (error) {
      // Update error handling: remove slug duplicate check
      if (error.code === 11000) {
        // Now the only unique constraint is likely {parent: 1, name: 1}
        return res.status(409).json({
          success: false,
          error: `A category with the same name already exists under this parent.`, // Adjusted message
        });
      }
      console.error("Error creating category:", error);
      res
        .status(500)
        .json({ success: false, error: "Server Error creating category" });
    }
  },
);
// --- END OF MODIFICATION ---

// --- MODIFY PUT (UPDATE) CATEGORY ROUTE ---
router.put(
  "/:id",
  fetchuser,
  isAdmin,
  [
    // Remove slug validation
    body("name", "Category name must be 2-50 characters")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 }),
    body("parent")
      .optional({ values: "falsy" })
      .if(body("parent").notEmpty())
      .isMongoId()
      .withMessage("Invalid parent category ID"),
    body("description")
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage("Description cannot exceed 200 characters"),
    // REMOVE: slug validation
    // body("slug")
    //   .optional()
    //   // ... rest of slug validation
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // ID validation remains the same
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid category ID format" });
    }

    try {
      const categoryId = req.params.id;
      // Get potential update fields, EXCLUDE slug
      const { name, parent, description } = req.body;
      // REMOVE: let manualSlug = req.body.slug;

      const categoryToUpdate = await Category.findById(categoryId);
      if (!categoryToUpdate) {
        return res
          .status(404)
          .json({ success: false, error: "Category not found" });
      }

      const updateData = {};
      // REMOVE: let slugNeedsUpdate = false;

      // Handle name update (no slug generation needed now)
      if (name !== undefined && name !== categoryToUpdate.name) {
        updateData.name = name;
        // REMOVE: if (!manualSlug) { slugNeedsUpdate = true; }
      }

      // Handle parent update (logic remains the same)
      if (parent !== undefined) {
        const parentId =
          parent && mongoose.Types.ObjectId.isValid(parent) ? parent : null;
        // Check for self-parenting
        if (parentId && parentId.toString() === categoryId) {
          return res.status(400).json({
            success: false,
            error: "Cannot set category as its own parent.",
          });
        }
        // Check if parent exists
        if (parentId) {
          const parentCategory = await Category.findById(parentId);
          if (!parentCategory) {
            return res.status(400).json({
              success: false,
              errors: [{ msg: "Parent category not found", param: "parent" }],
            });
          }
        }
        updateData.parent = parentId;
      }

      // Handle description update
      if (description !== undefined) updateData.description = description;

      if (Object.keys(updateData).length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "No fields provided for update." });
      }

      const updatedCategory = await Category.findByIdAndUpdate(
        categoryId,
        updateData,
        { new: true, runValidators: true },
      );

      res.json({ success: true, category: updatedCategory });
    } catch (error) {
      // Update error handling: remove slug duplicate check
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          // Adjust error message as needed, likely name/parent conflict now
          error: `Updating this category conflicts with an existing one (likely same name under the same parent).`,
        });
      }
      console.error("Error updating category:", error);
      res
        .status(500)
        .json({ success: false, error: "Server Error updating category" });
    }
  },
);
// --- END OF MODIFICATION ---

router.get("/tree/structured", async (req, res) => {
  // Changed path slightly for clarity
  try {
    const allCategories = await Category.find()
      .select("name parent description _id")
      .lean(); // Fetch only needed fields
    const categoryMap = {};
    const categoryTree = [];

    // Initialize map with children arrays
    allCategories.forEach((category) => {
      categoryMap[category._id.toString()] = { ...category, children: [] };
    });

    // Build the tree structure
    allCategories.forEach((category) => {
      const categoryNode = categoryMap[category._id.toString()];
      if (category.parent && categoryMap[category.parent.toString()]) {
        // Add to parent's children
        categoryMap[category.parent.toString()].children.push(categoryNode);
        // Sort children alphabetically (optional)
        categoryMap[category.parent.toString()].children.sort((a, b) =>
          a.name.localeCompare(b.name),
        );
      } else {
        // Add root categories to the main tree array
        categoryTree.push(categoryNode);
      }
    });

    // Sort root categories alphabetically (optional)
    categoryTree.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, categoryTree });
  } catch (error) {
    console.error("Error fetching category tree:", error);
    res
      .status(500)
      .json({ success: false, error: "Server Error fetching category tree" });
  }
});

module.exports = router;
