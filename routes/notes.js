// FILE: routes/notes.js
const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchuser");
const User = require("../models/User");
const Note = require("../models/Note");
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
    const note = await Note.findById(id).populate("user", "name  _id role");
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
    // Find the note by the unique slug field
    const note = await Note.findOne({ slug: slug }).populate(
      "user",
      "name _id role profilePictureUrl",
    ); // Populate user details

    if (!note) {
      console.warn(`Note not found with slug: ${slug}`);
      return res.status(404).json({ error: "Note not found" }); // Use generic error for public
    }
    console.log(`Note found by slug ${slug}: ${note.title}`);
    res.status(200).json(note);
  } catch (err) {
    console.error("Error fetching note by slug:", err.message);
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ error: "Invalid slug format" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET all notes irrespective of user
router.get("/fetchNotesIrrespective", async (req, res) => {
  // ... (no changes needed here)
  try {
    const allNotes = await Note.find({})
      .populate("user", "name")
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
    if (requestingUser.role === "admin") {
      console.log(
        "Fetching all notes for admin user:",
        requestingUser.email || req.user.id,
      );
      notes = await Note.find({})
        .populate("user", "name email ")
        .sort({ date: -1 });
    } else {
      console.log(
        "Fetching notes for regular user:",
        requestingUser.email || req.user.id,
      );
      notes = await Note.find({ user: req.user.id })
        .populate("user", "name ")
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
  fetchuser, // Middleware to authenticate user and get req.user.id
  [
    // Validation middleware array
    // Validate title: required, minimum 3 characters
    body("title", "Enter a valid title").isLength({ min: 3 }),

    // Validate description: required, minimum 5 characters
    body("description", "description must be atleast 5 characters").isLength({
      min: 5,
    }),

    // Validate type: required, must be one of the allowed enum values from the Note model
    body("type")
      .isIn([
        // *** THIS IS THE CORRECTED LIST ***
        "JavaScript",
        "Salesforce",
        "Sociology",
        "Life",
        "Technology",
        "Creative",
        "Tutorial",
        "News",
      ])
      .withMessage("Invalid note type selected."), // Optional: specific error message

    // Validate tag: optional string
    body("tag").optional().isString(),

    // Validate isFeatured: optional boolean
    body("isFeatured").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Log validation errors for easier debugging on the server
        console.error(
          "Validation errors in /addnote:",
          JSON.stringify(errors.array()),
        );
        return res.status(400).json({ errors: errors.array() });
      }

      // Fetch the requesting user's details (role needed for isFeatured logic)
      const requestingUser = await User.findById(req.user.id).select(
        "role email", // Select only necessary fields
      );
      if (!requestingUser) {
        // This case should ideally be caught by fetchuser, but good to double-check
        return res
          .status(401)
          .send({ error: "User not found or invalid token." });
      }

      // Destructure data from the request body
      const { title, description, tag, type } = req.body;
      let isFeatured = req.body.isFeatured || false; // Default isFeatured to false if not provided

      // Security Check: Only allow admins to set isFeatured to true
      if (isFeatured && requestingUser.role !== "admin") {
        console.warn(
          `User ${requestingUser.email || req.user.id} (role: ${
            requestingUser.role
          }) attempted to set isFeatured=true on add. Forcing to false.`,
        );
        isFeatured = false; // Override if a non-admin tries to set it
      }

      // --- Slug Generation ---
      // Generate a base slug from the title
      let baseSlug = slugify(title, {
        lower: true, // convert to lower case
        strict: true, // strip special characters except -
        remove: /[*+~.()'"!:@]/g, // remove specified characters
      });

      // Handle empty or invalid slugs (e.g., title was only symbols)
      if (!baseSlug) {
        baseSlug = `note-${Date.now()}`; // Fallback slug
      }

      let slug = baseSlug;
      let counter = 1;
      let existingNote = await Note.findOne({ slug: slug }); // Check if slug already exists

      // Handle slug collisions by appending a counter
      while (existingNote) {
        counter++;
        slug = `${baseSlug}-${counter}`;
        console.log(
          `Slug collision detected for '${baseSlug}'. Trying new slug: ${slug}`,
        );
        existingNote = await Note.findOne({ slug: slug }); // Check again with the new slug
      }
      console.log(`Final generated slug for note '${title}': ${slug}`);
      // --- End Slug Generation ---

      // --- Read Time Calculation ---
      // Simple word count based estimation
      const words = description.split(/\s+/).filter(Boolean).length; // Split by whitespace, remove empty strings
      const wordsPerMinute = 200; // Average reading speed
      const readTimeMinutes = Math.max(1, Math.ceil(words / wordsPerMinute)); // Ensure at least 1 min
      // --- End Read Time Calculation ---

      // Create a new Note instance using the Mongoose model
      const note = new Note({
        title,
        slug, // Use the generated unique slug
        description,
        tag: tag || "General", // Default tag if not provided
        type, // Use the validated type
        isFeatured, // Use the (potentially overridden) isFeatured value
        readTimeMinutes, // Add calculated read time
        user: req.user.id, // Associate the note with the logged-in user
        // 'date' will default to Date.now as per the schema
      });

      // Save the new note to the database
      const savedNote = await note.save();

      // Populate the user field in the saved note before sending the response
      // This adds the user's name/email to the response object automatically
      const populatedNote = await Note.findById(savedNote._id).populate(
        "user", // Field to populate
        "name email", // Fields to select from the User model
      );

      // Send the successfully saved (and populated) note back to the client
      res.status(201).json(populatedNote); // Use 201 Created status code
    } catch (error) {
      console.error("Error in /addnote route:", error.message);

      // Handle potential database errors (e.g., duplicate key error if slug generation failed unexpectedly)
      if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
        return res.status(409).json({
          // 409 Conflict might be more appropriate here
          errors: [
            {
              msg: "A note with a very similar title already exists, resulting in a duplicate URL slug. Please modify the title slightly.",
              param: "title", // Indicate which field likely caused the issue
              location: "body",
            },
          ],
        });
      }

      // Generic server error for other issues
      res.status(500).send("Internal Server Error");
    }
  },
);

// PUT Update an existing Note using: PUT "/api/notes/updatenote/:id". Login required
router.put(
  "/updatenote/:id",
  fetchuser,
  restrictToOwnerOrAdmin, // Add new middleware
  [
    body("title", "Enter a valid title").optional().isLength({ min: 3 }),
    body("description", "description must be atleast 5 characters")
      .optional()
      .isLength({ min: 5 }),
    body("type")
      .optional()
      .isIn([
        "JavaScript",
        "Salesforce",
        "Sociology",
        "Life",
        "Technology",
        "Creative",
        "Tutorial",
        "News",
      ]), // Fix type validation
    body("tag").optional(),
    body("isFeatured").optional().isBoolean(),
  ],
  async (req, res) => {
    const { title, description, tag, type } = req.body;
    let clientIsFeatured = req.body.isFeatured;
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const updateFields = {};
      if (title !== undefined) updateFields.title = title;
      if (description !== undefined) {
        updateFields.description = description;
        const words = description.split(/\s+/).filter(Boolean).length;
        const wordsPerMinute = 200;
        updateFields.readTimeMinutes = Math.max(
          1,
          Math.ceil(words / wordsPerMinute),
        );
      }
      if (tag !== undefined) updateFields.tag = tag;
      if (type !== undefined) updateFields.type = type;
      if (
        clientIsFeatured !== undefined &&
        req.requestingUser.role === "admin"
      ) {
        updateFields.isFeatured = clientIsFeatured;
      }
      if (Object.keys(updateFields).length === 0) {
        return res
          .status(400)
          .json({ error: "No valid fields provided for update" });
      }
      const updatedNote = await Note.findByIdAndUpdate(
        req.params.id,
        { $set: updateFields },
        { new: true },
      ).populate("user", "name ");
      res.json({ note: updatedNote });
    } catch (error) {
      console.error("Error in /updatenote:", error.message);
      res.status(500).json({ error: "Internal Server Error" });
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
  // ... (no changes needed here, imageUrl just won't be part of the fetched note) ...
  try {
    const { lastId, type } = req.query;
    const limit = parseInt(req.query.limit) || 1; // Default limit
    let query = {};

    // Filter by type if provided and valid
    if (type && type !== "all") {
      const validTypes = Note.schema.path("type").enumValues;
      if (validTypes.includes(type)) query.type = type;
      // else: ignore invalid type or return error/empty based on desired behavior
    }

    // Add cursor condition if lastId is provided
    if (lastId) {
      if (!mongoose.Types.ObjectId.isValid(lastId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid lastId format" });
      }
      // Use $lt for descending sort on _id
      query._id = { $lt: lastId };
    }

    // Fetch notes
    const notes = await Note.find(query)
      .sort({ _id: -1 }) // Use _id for cursor pagination (descending)
      .limit(limit)
      .populate("user", "name "); // Populate user details

    // Determine the next lastId and if there are more notes
    const nextLastId = notes.length > 0 ? notes[notes.length - 1]._id : null; // Use null if no notes found
    let hasMore = false;
    if (nextLastId) {
      // Check if there are more documents beyond the current last fetched one
      const remainingCount = await Note.countDocuments({
        ...query, // Keep the type filter if applied
        _id: { $lt: nextLastId }, // Check for IDs smaller than the last one fetched
      });
      hasMore = remainingCount > 0;
    }

    console.log("fetchNextNote response:", {
      inputLastId: lastId,
      fetchedNoteIds: notes.map((n) => n._id),
      outputNextLastId: nextLastId,
      hasMore,
      //totalRemaining: remainingCount // If you need this count
    });

    res.status(200).json({
      success: true,
      notes,
      hasMore,
      nextLastId, // Send the ID of the last item fetched
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

// Fetch Featured Notes in Batches (Paginated)
router.get("/featured/batch", async (req, res) => {
  try {
    const { lastId } = req.query; // Get the last fetched note's ID
    const limit = parseInt(req.query.limit) || 5; // Default batch size to 5

    let query = { isFeatured: true }; // Base query for featured notes

    if (lastId) {
      if (!mongoose.Types.ObjectId.isValid(lastId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid lastId format" });
      }
      // Find featured notes older than the lastId (assuming _id sort descending)
      query._id = { $lt: lastId };
    }

    const notes = await Note.find(query)
      .sort({ _id: -1 }) // Sort by _id descending for stable pagination
      .limit(limit)
      .populate("user", "name ");

    const nextLastId = notes.length > 0 ? notes[notes.length - 1]._id : null;

    let hasMore = false;
    if (nextLastId) {
      // Check if there are any more featured notes beyond the current batch
      const remainingCount = await Note.countDocuments({
        isFeatured: true, // Ensure we only count featured notes
        _id: { $lt: nextLastId },
      });
      hasMore = remainingCount > 0;
    }

    console.log("fetchFeatured/batch response:", {
      inputLastId: lastId,
      fetchedNoteIds: notes.map((n) => n._id),
      outputNextLastId: nextLastId,
      hasMore,
    });

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
  // ... (no changes needed here, imageUrl just won't be part of the fetched note) ...
  try {
    const limit = parseInt(req.query.limit) || 3; // Default limit to 3
    const featuredNotes = await Note.find({ isFeatured: true })
      .populate("user", "name ")
      .sort({ date: -1 }) // Sort by most recent date
      .limit(limit);
    res.json({ success: true, notes: featuredNotes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

// GET Search notes
router.get("/search", async (req, res) => {
  // ... (no changes needed here) ...
  try {
    const searchQuery = req.query.query;
    const limit = parseInt(req.query.limit) || 10; // Default limit

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

    // Search in title, description, and tags (case-insensitive)
    const notes = await Note.find({
      $or: [
        { title: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } },
        { tag: { $regex: searchQuery, $options: "i" } }, // Also search in tag
      ],
    })
      .populate("user", "name ") // Populate user info
      .sort({ date: -1 }) // Sort by date descending
      .limit(limit);

    res.json({ success: true, notes: notes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

// GET Distinct note types
router.get("/types", async (req, res) => {
  // ... (no changes needed here) ...
  try {
    const types = await Note.distinct("type");
    // Filter out any null or empty string types if they exist
    const validTypes = types.filter((type) => type);
    res.json({ success: true, types: validTypes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

// GET Recent post titles
router.get("/recent", async (req, res) => {
  // ... (no changes needed here) ...
  try {
    const limit = parseInt(req.query.limit) || 5; // Default limit
    const recentNotes = await Note.find({})
      .sort({ date: -1 }) // Sort by most recent
      .limit(limit)
      .select("title _id date slug type tag"); // Select only needed fields
    res.json({ success: true, notes: recentNotes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
