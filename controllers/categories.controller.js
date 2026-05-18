const { validationResult } = require("express-validator");
const mongoose = require("mongoose");
const categoriesService = require("../services/categories.service");

async function getAll(req, res) {
  try {
    const categories = await categoriesService.getAllCategories();
    res.json({ success: true, categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ success: false, error: "Server Error fetching categories" });
  }
}

async function getTree(req, res) {
  try {
    const categoryTree = await categoriesService.getCategoryTree();
    res.json({ success: true, categoryTree });
  } catch (error) {
    console.error("Error fetching category tree:", error);
    res.status(500).json({ success: false, error: "Server Error fetching category tree" });
  }
}

async function getStructuredTree(req, res) {
  try {
    const categoryTree = await categoriesService.getStructuredCategoryTree();
    res.json({ success: true, categoryTree });
  } catch (error) {
    console.error("Error fetching category tree:", error);
    res.status(500).json({ success: false, error: "Server Error fetching category tree" });
  }
}

async function getOne(req, res) {
  try {
    const category = await categoriesService.getCategoryById(req.params.id);
    res.json({ success: true, category });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, error: error.message });
    if (error.statusCode === 404) return res.status(404).json({ success: false, error: error.message });
    console.error("Error fetching single category:", error);
    res.status(500).json({ success: false, error: "Server Error fetching category" });
  }
}

async function create(req, res) {
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

    const newCategory = await categoriesService.createCategory({ name, parentId, description });
    res.status(201).json({ success: true, category: newCategory });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: error.message, param: error.param || "general" }],
      });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "A category with the same name already exists under this parent.",
      });
    }
    console.error("Error creating category:", error);
    res.status(500).json({ success: false, error: "Server Error creating category" });
  }
}

async function update(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, error: "Invalid category ID format" });
  }

  try {
    const categoryId = req.params.id;
    const { name, parent, description } = req.body;

    // Fetch current document for comparison in service
    const Category = require("../models/Category");
    const categoryToUpdate = await Category.findById(categoryId);
    if (!categoryToUpdate) {
      return res.status(404).json({ success: false, error: "Category not found" });
    }

    const updatedCategory = await categoriesService.updateCategory({
      categoryId,
      name,
      parent,
      description,
      currentCategory: categoryToUpdate,
    });

    res.json({ success: true, category: updatedCategory });
  } catch (error) {
    if (error.statusCode === 400) {
      if (error.param) {
        return res.status(400).json({
          success: false,
          errors: [{ msg: error.message, param: error.param }],
        });
      }
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Updating this category conflicts with an existing one (likely same name under the same parent).",
      });
    }
    console.error("Error updating category:", error);
    res.status(500).json({ success: false, error: "Server Error updating category" });
  }
}

module.exports = { getAll, getTree, getStructuredTree, getOne, create, update };
