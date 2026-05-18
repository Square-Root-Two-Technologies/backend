const mongoose = require("mongoose");
const Category = require("../models/Category");

async function getAllCategories() {
  return Category.find().sort({ parent: 1, name: 1 }).lean();
}

async function getCategoryTree() {
  const allCategories = await Category.find().sort({ name: 1 }).lean();
  const categoryMap = {};
  const categoryTree = [];

  allCategories.forEach((category) => {
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

  return categoryTree;
}

async function getStructuredCategoryTree() {
  const allCategories = await Category.find()
    .select("name parent description _id")
    .lean();
  const categoryMap = {};
  const categoryTree = [];

  allCategories.forEach((category) => {
    categoryMap[category._id.toString()] = { ...category, children: [] };
  });

  allCategories.forEach((category) => {
    const categoryNode = categoryMap[category._id.toString()];
    if (category.parent && categoryMap[category.parent.toString()]) {
      categoryMap[category.parent.toString()].children.push(categoryNode);
      categoryMap[category.parent.toString()].children.sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    } else {
      categoryTree.push(categoryNode);
    }
  });

  categoryTree.sort((a, b) => a.name.localeCompare(b.name));
  return categoryTree;
}

async function getCategoryById(categoryId) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    const err = new Error("Invalid Category ID format");
    err.statusCode = 400;
    throw err;
  }

  const category = await Category.findById(categoryId).populate("parent", "name");
  if (!category) {
    const err = new Error("Category not found");
    err.statusCode = 404;
    throw err;
  }

  return category;
}

async function createCategory({ name, parentId, description }) {
  if (parentId) {
    const parentCategory = await Category.findById(parentId);
    if (!parentCategory) {
      const err = new Error("Parent category not found");
      err.statusCode = 400;
      err.param = "parent";
      throw err;
    }
  }

  const newCategory = new Category({ name, parent: parentId, description });
  await newCategory.save();
  return newCategory;
}

async function updateCategory({ categoryId, name, parent, description, currentCategory }) {
  const updateData = {};

  if (name !== undefined && name !== currentCategory.name) {
    updateData.name = name;
  }

  if (parent !== undefined) {
    const parentId =
      parent && mongoose.Types.ObjectId.isValid(parent) ? parent : null;

    if (parentId && parentId.toString() === categoryId) {
      const err = new Error("Cannot set category as its own parent.");
      err.statusCode = 400;
      throw err;
    }

    if (parentId) {
      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        const err = new Error("Parent category not found");
        err.statusCode = 400;
        err.param = "parent";
        throw err;
      }
    }

    updateData.parent = parentId;
  }

  if (description !== undefined) updateData.description = description;

  if (Object.keys(updateData).length === 0) {
    const err = new Error("No fields provided for update.");
    err.statusCode = 400;
    throw err;
  }

  return Category.findByIdAndUpdate(categoryId, updateData, { new: true, runValidators: true });
}

module.exports = {
  getAllCategories,
  getCategoryTree,
  getStructuredCategoryTree,
  getCategoryById,
  createCategory,
  updateCategory,
};
