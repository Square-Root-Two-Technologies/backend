const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const fetchuser = require("../middleware/fetchuser");
const isAdmin = require("../middleware/isAdmin");
const restrictToOwnerOrAdmin = require("../middleware/restrictToOwnerOrAdmin");
const notesController = require("../controllers/notes.controller");

// GET /api/notes/fetchNotesIrrespective/:id
router.get("/fetchNotesIrrespective/:id", notesController.getNote);

// GET /api/notes/fetchNoteBySlug/:slug
router.get("/fetchNoteBySlug/:slug", notesController.getNoteBySlug);

// GET /api/notes/fetchNotesIrrespective
router.get("/fetchNotesIrrespective", notesController.getAllNotes);

// GET /api/notes/fetchallnotes — logged-in user's notes (or all for admin)
router.get("/fetchallnotes", fetchuser, notesController.getUserNotes);

// POST /api/notes/addnote
router.post(
  "/addnote",
  fetchuser,
  [
    body("title", "Enter a valid title").trim().isLength({ min: 3 }),
    body("description", "Description must be atleast 5 characters").isLength({ min: 5 }),
    body("category", "Category is required").isMongoId().withMessage("Invalid Category ID format."),
    body("tag").optional().trim().isString(),
    body("isFeatured").optional().isBoolean(),
  ],
  notesController.addNote,
);

// PUT /api/notes/updatenote/:id
router.put(
  "/updatenote/:id",
  fetchuser,
  restrictToOwnerOrAdmin,
  [
    body("title", "Enter a valid title").optional().trim().isLength({ min: 3 }),
    body("description", "Description must be atleast 5 characters").optional().isLength({ min: 5 }),
    body("category", "Invalid Category ID format").optional().isMongoId(),
    body("tag").optional().trim(),
    body("isFeatured").optional().isBoolean(),
  ],
  notesController.updateNote,
);

// DELETE /api/notes/deletenote/:id
router.delete("/deletenote/:id", fetchuser, restrictToOwnerOrAdmin, notesController.deleteNote);

// GET /api/notes/fetchNextNote — paginated
router.get("/fetchNextNote", notesController.paginatedNotes);

// GET /api/notes/featured/batch — featured paginated
router.get("/featured/batch", notesController.featuredBatch);

// GET /api/notes/featured
router.get("/featured", notesController.featured);

// GET /api/notes/search
router.get("/search", notesController.search);

// GET /api/notes/recent
router.get("/recent", notesController.recent);

// GET /api/notes/by-category/:categoryId
router.get("/by-category/:categoryId", notesController.byCategory);

// GET /api/notes/by-category/:categoryId/titles
router.get("/by-category/:categoryId/titles", notesController.byCategoryTitles);

// DELETE /api/notes/by-category/:categoryId — admin only
router.delete("/by-category/:categoryId", fetchuser, isAdmin, notesController.deleteByCategory);

module.exports = router;
