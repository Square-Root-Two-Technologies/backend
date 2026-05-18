const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const fetchuser = require("../middleware/fetchuser");
const isAdmin = require("../middleware/isAdmin");
const categoriesController = require("../controllers/categories.controller");

// GET /api/categories/tree/structured  — must be before /:id
router.get("/tree/structured", categoriesController.getStructuredTree);

// GET /api/categories/tree
router.get("/tree", categoriesController.getTree);

// GET /api/categories/
router.get("/", categoriesController.getAll);

// GET /api/categories/:id
router.get("/:id", categoriesController.getOne);

// POST /api/categories/ — admin only
router.post(
  "/",
  fetchuser,
  isAdmin,
  [
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
  categoriesController.create,
);

// PUT /api/categories/:id — admin only
router.put(
  "/:id",
  fetchuser,
  isAdmin,
  [
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
  ],
  categoriesController.update,
);

module.exports = router;
