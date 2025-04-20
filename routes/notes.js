// FILE: routes/notes.js
const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchuser");
const User = require("../models/User");
const Note = require("../models/Note");
const Category = require("../models/Category");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
var restrictToOwnerOrAdmin = require("../middleware/restrictToOwnerOrAdmin");
const slugify = require("slugify");

// ... (fetchNotesIrrespective/:id, fetchNotesIrrespective, fetchallnotes, fetchNotesIrrespectiveByType/:type remain the same) ...
// GET a specific note irrespective of user
router.get("/fetchNotesIrrespective/:id", async (req, res) => {
  // ... (no changes needed here, populate still works but won't fetch imageUrl)
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid Note ID format" });
    }
    // Populate user details, imageUrl won't be present on the note object itself
    const note = await Note.findById(id)
      .populate("user", "name  _id role profilePictureUrl")
      .populate("category", "name");
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }
    res.status(200).json(note);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- NEW ROUTE: Fetch a single note by its SLUG ---
router.get("/fetchNoteBySlug/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    const note = await Note.findOne({ slug: slug })
      .populate("user", "name _id role profilePictureUrl") // Keep user population
      .populate("category", "name parent _id"); // Populate category with _id and parent

    if (!note) {
      console.warn(`Note not found with slug: ${slug}`);
      return res.status(404).json({ error: "Note not found" });
    }

    let ancestorPath = [];
    if (note.category && note.category._id) {
      // Fetch ancestors using the helper function
      ancestorPath = await getCategoryAncestors(note.category._id);
    }

    // Convert note to object to add the ancestor path
    const noteObject = note.toObject();
    noteObject.ancestorPath = ancestorPath; // Add the path to the response

    console.log(`Note found by slug ${slug}: ${note.title}`);
    res.status(200).json(noteObject); // Send the modified object
  } catch (err) {
    console.error("Error fetching note by slug:", err.message);
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ error: "Invalid slug format" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Helper function to get ancestors ---
async function getCategoryAncestors(categoryId) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    return [];
  }
  let ancestors = [];
  let currentId = categoryId;

  try {
    while (currentId) {
      // Find category, select only needed fields, use lean for performance
      const category = await Category.findById(currentId)
        .select("_id name parent")
        .lean();
      if (!category) {
        break; // Stop if category not found
      }
      // Add to the beginning of the array for correct order (root first)
      ancestors.unshift({ _id: category._id, name: category.name });
      currentId = category.parent; // Move up to the parent
    }
  } catch (err) {
    console.error("Error fetching ancestors for category", categoryId, err);
    // Return potentially partial path or empty on error
    return ancestors;
  }
  return ancestors;
}

// GET all notes irrespective of user
router.get("/fetchNotesIrrespective", async (req, res) => {
  // ... (no changes needed here)
  try {
    const allNotes = await Note.find({})
      .populate("user", "name")
      .populate("category", "name")
      .sort({ date: -1 });
    res.status(200).json(allNotes);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET all notes for the logged-in user
router.get("/fetchallnotes", fetchuser, async (req, res) => {
  try {
    const requestingUser = await User.findById(req.user.id).select("role"); // Standardized
    if (!requestingUser) {
      return res.status(401).json({ error: "User not found or invalid token" });
    }
    let notes;
    const populateFields = [
      { path: "user", select: "name email profilePictureUrl" },
      { path: "category", select: "name" },
    ];
    if (requestingUser.role === "admin") {
      console.log(
        "Fetching all notes for admin user:",
        requestingUser.email || req.user.id,
      );
      notes = await Note.find({}).populate(populateFields).sort({ date: -1 });
    } else {
      console.log(
        "Fetching notes for regular user:",
        requestingUser.email || req.user.id,
      );
      notes = await Note.find({ user: req.user.id })
        .populate(populateFields)
        .sort({ date: -1 });
    }
    res.json(notes);
  } catch (error) {
    console.error("Error in /fetchallnotes:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET notes by type (irrespective of user)
router.get("/fetchNotesIrrespectiveByType/:type", async (req, res) => {
  // ... (no changes needed here)
  try {
    const type = req.params.type;
    let query = {};
    if (type && type !== "all") {
      const validTypes = Note.schema.path("type").enumValues;
      if (validTypes.includes(type)) {
        query.type = type;
      } else {
        console.warn(`Invalid type requested: ${type}`);
        // Return empty array or handle as needed for invalid type
        return res.status(200).json([]);
      }
    }
    const notes = await Note.find(query)
      .populate("user", "name ")
      .sort({ date: -1 });
    res.status(200).json(notes);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST Add a new Note using: POST "/api/notes/addnote". Login required
router.post(
  "/addnote",
  fetchuser,
  [
    body("title", "Enter a valid title").trim().isLength({ min: 3 }),
    body("description", "Description must be atleast 5 characters").isLength({
      min: 5,
    }),
    // --- REMOVED 'type' validation ---
    // body("type").isIn([ /* old enum values */ ]).withMessage("Invalid note type selected."),
    // --- ADDED 'category' validation ---
    body("category", "Category is required")
      .isMongoId()
      .withMessage("Invalid Category ID format."),
    body("tag").optional().trim().isString(),
    body("isFeatured").optional().isBoolean(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.error(
        "Validation errors in /addnote:",
        JSON.stringify(errors.array()),
      );
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const requestingUser = await User.findById(req.user.id).select(
        "role email",
      );
      if (!requestingUser) {
        return res
          .status(401)
          .json({ success: false, error: "User not found or invalid token." });
      }

      const { title, description, tag, category: categoryId } = req.body; // Get category ID
      let isFeatured = req.body.isFeatured || false;

      // Check if category exists
      const categoryExists = await Category.findById(categoryId);
      if (!categoryExists) {
        return res.status(400).json({
          success: false,
          errors: [
            { msg: "Selected category does not exist", param: "category" },
          ],
        });
      }

      // Admin check for isFeatured
      if (isFeatured && requestingUser.role !== "admin") {
        console.warn(
          `User ${requestingUser.email || req.user.id} (role: ${
            requestingUser.role
          }) attempted to set isFeatured=true on add. Forcing to false.`,
        );
        isFeatured = false;
      }

      // --- Slug Generation Logic (same as before) ---
      let baseSlug = slugify(title, {
        lower: true,
        strict: true,
        remove: /[*+~.()'"!:@]/g,
      });
      if (!baseSlug) {
        baseSlug = `note-${Date.now()}`;
      }
      let slug = baseSlug;
      let counter = 1;
      let existingNote = await Note.findOne({ slug: slug });
      while (existingNote) {
        counter++;
        slug = `${baseSlug}-${counter}`;
        console.log(
          `Slug collision detected for '${baseSlug}'. Trying new slug: ${slug}`,
        );
        existingNote = await Note.findOne({ slug: slug });
      }
      console.log(`Final generated slug for note '${title}': ${slug}`);

      const note = new Note({
        title,
        slug,
        description,
        tag: tag || "General",
        category: categoryId, // Save the category ID
        isFeatured,
        // readTimeMinutes, // Calculated by pre-save hook now
        user: req.user.id,
      });

      const savedNote = await note.save();

      // Populate the response
      const populatedNote = await Note.findById(savedNote._id)
        .populate("user", "name email profilePictureUrl") // Select user fields
        .populate("category", "name"); // Select category fields

      res.status(201).json(populatedNote); // Send populated note back
    } catch (error) {
      console.error("Error in /addnote route:", error.message);
      if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
        return res.status(409).json({
          success: false,
          errors: [
            {
              msg: "A note with a very similar title already exists, resulting in a duplicate URL slug. Please modify the title slightly.",
              param: "title",
              location: "body",
            },
          ],
        });
      }
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  },
);

// PUT Update an existing Note using: PUT "/api/notes/updatenote/:id". Login required
router.put(
  "/updatenote/:id",
  fetchuser,
  restrictToOwnerOrAdmin, // This middleware already finds the note and checks permissions
  [
    body("title", "Enter a valid title").optional().trim().isLength({ min: 3 }),
    body("description", "Description must be atleast 5 characters")
      .optional()
      .isLength({ min: 5 }),
    // --- REMOVED 'type' validation ---
    // body("type").optional().isIn([ /* old enum values */ ]),
    // --- ADDED 'category' validation ---
    body("category", "Invalid Category ID format").optional().isMongoId(),
    body("tag").optional().trim(),
    body("isFeatured").optional().isBoolean(),
    // Optional: Add slug validation if you allow manual slug updates
    // body("slug").optional().trim().isString().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Note is already available in req.note from restrictToOwnerOrAdmin middleware
    const noteToUpdate = req.note;

    try {
      const { title, description, tag, category: categoryId } = req.body;
      let clientIsFeatured = req.body.isFeatured;

      const updateFields = {};
      let slugNeedsUpdate = false;

      if (title !== undefined && title !== noteToUpdate.title) {
        updateFields.title = title;
        // Decide if slug should update automatically when title changes
        // For now, let's NOT auto-update slug on edit to preserve existing URLs
        // slugNeedsUpdate = true; // Uncomment to auto-update slug
      }
      if (description !== undefined) {
        updateFields.description = description;
        // Calculate read time (or rely on pre-save hook if using findByIdAndUpdate with runValidators)
        const words = description.split(/\s+/).filter(Boolean).length;
        const wordsPerMinute = 200;
        updateFields.readTimeMinutes = Math.max(
          1,
          Math.ceil(words / wordsPerMinute),
        );
      }
      if (tag !== undefined) updateFields.tag = tag;

      // Handle category update
      if (
        categoryId !== undefined &&
        categoryId !== noteToUpdate.category.toString()
      ) {
        const categoryExists = await Category.findById(categoryId);
        if (!categoryExists) {
          return res.status(400).json({
            success: false,
            errors: [
              { msg: "Selected category does not exist", param: "category" },
            ],
          });
        }
        updateFields.category = categoryId;
      }

      // Handle isFeatured update (only by admin)
      if (
        clientIsFeatured !== undefined &&
        req.requestingUser.role === "admin"
      ) {
        updateFields.isFeatured = clientIsFeatured;
      } else if (
        clientIsFeatured !== undefined &&
        req.requestingUser.role !== "admin"
      ) {
        console.warn(
          `Non-admin user ${req.user.id} tried to change isFeatured on update for note ${req.params.id}. Ignoring.`,
        );
      }

      if (Object.keys(updateFields).length === 0) {
        return res.status(400).json({
          success: false,
          error: "No valid fields provided for update",
        });
      }

      const updatedNote = await Note.findByIdAndUpdate(
        req.params.id,
        { $set: updateFields },
        { new: true, runValidators: true }, // runValidators ensures schema validation on update
      )
        .populate("user", "name email profilePictureUrl")
        .populate("category", "name ");

      if (!updatedNote) {
        // Should not happen due to restrictToOwnerOrAdmin, but good practice
        return res.status(404).json({
          success: false,
          error: "Note not found after update attempt.",
        });
      }

      res.json({ success: true, note: updatedNote }); // Send populated note back
    } catch (error) {
      if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
        return res.status(409).json({
          success: false,
          error:
            "Updating this note would result in a duplicate URL slug. Please modify the title or slug slightly.",
        });
      }
      console.error("Error in /updatenote:", error.message);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  },
);

// DELETE an existing Note using: DELETE "/api/notes/deletenote/:id". Login required
router.delete(
  "/deletenote/:id",
  fetchuser,
  restrictToOwnerOrAdmin,
  async (req, res) => {
    try {
      const deletedNote = await Note.findByIdAndDelete(req.params.id);
      res.json({ success: true, note: deletedNote }); // Standardize response
    } catch (error) {
      console.error("Error in /deletenote:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

// GET Paginated notes irrespective of user
router.get("/fetchNextNote", async (req, res) => {
  try {
    const { lastId, categoryIdOrSlug } = req.query; // Changed 'type' to 'categoryIdOrSlug'
    const limit = parseInt(req.query.limit) || 9; // Default limit
    let query = {};

    // Filter by Category if provided
    if (categoryIdOrSlug && categoryIdOrSlug !== "all") {
      let categoryFilter = null;
      if (mongoose.Types.ObjectId.isValid(categoryIdOrSlug)) {
        categoryFilter = await Category.findById(categoryIdOrSlug).select(
          "_id",
        );
      } else {
        categoryFilter = await Category.findOne({
          slug: categoryIdOrSlug,
        }).select("_id");
      }

      if (categoryFilter) {
        query.category = categoryFilter._id;
      } else {
        console.warn(
          `Category filter specified (${categoryIdOrSlug}) but not found. Returning empty.`,
        );
        return res
          .status(200)
          .json({ success: true, notes: [], hasMore: false, nextLastId: null });
      }
    }

    // Pagination Logic
    if (lastId) {
      if (!mongoose.Types.ObjectId.isValid(lastId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid lastId format" });
      }
      query._id = { $lt: lastId }; // Use _id for consistent sorting/pagination
    }

    const notes = await Note.find(query)
      .sort({ _id: -1 }) // Sort by _id descending for consistent pagination
      .limit(limit)
      .populate("user", "name profilePictureUrl") // Populate user
      .populate("category", "name"); // Populate category

    const nextLastId = notes.length > 0 ? notes[notes.length - 1]._id : null;

    // Check if there are more notes
    let hasMore = false;
    if (nextLastId) {
      // Count documents matching the query with _id less than the last fetched one
      const remainingCountQuery = { ...query, _id: { $lt: nextLastId } };
      const remainingCount = await Note.countDocuments(remainingCountQuery);
      hasMore = remainingCount > 0;
    }

    // console.log("fetchNextNote response:", { inputLastId: lastId, fetchedCount: notes.length, outputNextLastId: nextLastId, hasMore });

    res.status(200).json({
      success: true,
      notes,
      hasMore,
      nextLastId,
    });
  } catch (err) {
    console.error("Error in fetchNextNote:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Fetch Featured Notes in Batches (Paginated)
router.get("/featured/batch", async (req, res) => {
  try {
    const { lastId } = req.query;
    const limit = parseInt(req.query.limit) || 5;
    let query = { isFeatured: true };

    if (lastId) {
      if (!mongoose.Types.ObjectId.isValid(lastId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid lastId format" });
      }
      query._id = { $lt: lastId };
    }

    const notes = await Note.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate("user", "name profilePictureUrl") // Populate needed fields
      .populate("category", "name "); // Populate category

    const nextLastId = notes.length > 0 ? notes[notes.length - 1]._id : null;
    let hasMore = false;
    if (nextLastId) {
      const remainingCount = await Note.countDocuments({
        isFeatured: true,
        _id: { $lt: nextLastId },
      });
      hasMore = remainingCount > 0;
    }

    res.status(200).json({
      success: true,
      notes,
      hasMore,
      nextLastId,
    });
  } catch (err) {
    console.error("Error fetching featured notes batch:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// GET Featured notes
router.get("/featured", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const featuredNotes = await Note.find({ isFeatured: true })
      .populate("user", "name profilePictureUrl")
      .populate("category", "name ") // Populate category
      .sort({ date: -1 })
      .limit(limit);
    res.json({ success: true, notes: featuredNotes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

// GET Search notes
router.get("/search", async (req, res) => {
  try {
    const searchQuery = req.query.query;
    const limit = parseInt(req.query.limit) || 20; // Increased limit
    if (
      !searchQuery ||
      typeof searchQuery !== "string" ||
      searchQuery.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Search query parameter is required and must be a non-empty string.",
      });
    }

    // Option 1: Search notes directly (title, description, tag)
    const notes = await Note.find({
      $or: [
        { title: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } },
        { tag: { $regex: searchQuery, $options: "i" } },
      ],
    })
      .populate("user", "name profilePictureUrl")
      .populate("category", "name ") // Populate category
      .sort({ date: -1 }) // Or sort by relevance score if using text index
      .limit(limit);

    res.json({ success: true, notes: notes });
  } catch (err) {
    console.error("Search Error:", err.message);
    res.status(500).send("Internal Server Error");
  }
});

// GET /recent - Populate Category
router.get("/recent", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const recentNotes = await Note.find({})
      .sort({ date: -1 })
      .limit(limit)
      .select("title _id date slug category tag") // Keep tag, select category ID
      .populate("category", "name "); // Populate category name/slug

    res.json({ success: true, notes: recentNotes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/by-category/:categoryId", async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { lastId } = req.query;
    const limit = parseInt(req.query.limit) || 9; // Use a limit consistent with HomeScreen or adjust as needed

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid Category ID format" });
    }

    // Verify category exists (optional but good practice)
    const category = await Category.findById(categoryId).select("_id name"); // Select only needed fields
    if (!category) {
      return res
        .status(404)
        .json({ success: false, error: "Category not found" });
    }

    let query = { category: category._id };

    if (lastId) {
      if (!mongoose.Types.ObjectId.isValid(lastId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid lastId format" });
      }
      // Use $lt for descending sort by _id (most recent first)
      query._id = { $lt: lastId };
    }

    const notes = await Note.find(query)
      .sort({ _id: -1 }) // Sort by _id descending for consistent pagination
      .limit(limit)
      .populate("user", "name profilePictureUrl") // Keep necessary fields
      .populate("category", "name"); // Keep necessary fields

    const nextLastId = notes.length > 0 ? notes[notes.length - 1]._id : null;

    let hasMore = false;
    if (nextLastId) {
      // Check if there's at least one more note older than the last one fetched
      const remainingCount = await Note.countDocuments({
        category: category._id, // Ensure we only count within the same category
        _id: { $lt: nextLastId },
      });
      hasMore = remainingCount > 0;
    }

    console.log(
      `Category ${categoryId} Notes: Fetched ${notes.length}, HasMore: ${hasMore}, NextLastId: ${nextLastId}`,
    );

    res.json({
      success: true,
      notes,
      category: { name: category.name, _id: category._id }, // Include basic category info if needed
      hasMore,
      nextLastId,
    });
  } catch (error) {
    console.error("Error fetching notes by category:", error);
    res.status(500).json({
      success: false,
      error: "Server Error fetching notes by category",
    });
  }
});

// NEW ROUTE: Get all note titles for a specific category, sorted alphabetically
router.get("/by-category/:categoryId/titles", async (req, res) => {
  try {
    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid Category ID format" });
    }

    // Optional: Check if category exists first (good practice)
    const categoryExists = await Category.findById(categoryId).select("_id");
    if (!categoryExists) {
      return res
        .status(404)
        .json({ success: false, error: "Category not found" });
    }

    const notes = await Note.find({ category: categoryId })
      .select("_id title slug") // Select only needed fields
      .sort({ title: 1 }) // Sort alphabetically by title (case-insensitive usually by default in MongoDB)
      // For explicit case-insensitivity if needed: .collation({ locale: 'en', strength: 2 })
      .lean(); // Use lean for performance if only reading data

    console.log(
      `Workspaceed ${notes.length} note titles for category ${categoryId}`,
    );
    res.json({ success: true, notes: notes });
  } catch (error) {
    console.error("Error fetching note titles by category:", error);
    res.status(500).json({
      success: false,
      error: "Server Error fetching note titles",
    });
  }
});

module.exports = router;
