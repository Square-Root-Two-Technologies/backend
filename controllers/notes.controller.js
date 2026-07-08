const { validationResult } = require("express-validator");
const notesService = require("../services/notes.service");
const User = require("../models/User");

async function getNote(req, res) {
  try {
    const note = await notesService.getNoteById(req.params.id);
    res.status(200).json(note);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    console.error(err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getNoteBySlug(req, res) {
  try {
    const noteObject = await notesService.getNoteBySlug(req.params.slug);
    res.status(200).json(noteObject);
  } catch (err) {
    if (err.statusCode === 404) return res.status(404).json({ error: err.message });
    console.error("Error fetching note by slug:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getAllNotes(req, res) {
  try {
    const allNotes = await notesService.getAllNotes();
    res.status(200).json(allNotes);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getUserNotes(req, res) {
  try {
    const requestingUser = await User.findById(req.user.id).select("role");
    if (!requestingUser) {
      return res.status(401).json({ error: "User not found or invalid token" });
    }
    const notes = await notesService.getUserNotes(req.user.id, requestingUser.role);
    res.json(notes);
  } catch (error) {
    console.error("Error in /fetchallnotes:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function addNote(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.error("Validation errors in /addnote:", JSON.stringify(errors.array()));
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const requestingUser = await User.findById(req.user.id).select("role email");
    if (!requestingUser) {
      return res.status(401).json({ success: false, error: "User not found or invalid token." });
    }

    const { title, description, tag, category: categoryId } = req.body;
    const isFeatured = req.body.isFeatured || false;
    const isActive = req.body.isActive !== undefined ? req.body.isActive : true;

    const populatedNote = await notesService.addNote({
      title,
      description,
      tag,
      categoryId,
      isFeatured,
      isActive,
      userId: req.user.id,
      userRole: requestingUser.role,
    });

    res.status(201).json(populatedNote);
  } catch (error) {
    console.error("Error in /addnote route:", error.message);
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        errors: [{ msg: error.message, param: error.param || "general" }],
      });
    }
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
}

async function updateNote(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const noteToUpdate = req.note; // set by restrictToOwnerOrAdmin middleware

  try {
    const updatedNote = await notesService.updateNote({
      noteToUpdate,
      noteId: req.params.id,
      body: req.body,
      requestingUserRole: req.requestingUser.role,
    });

    res.json({ success: true, note: updatedNote });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        errors: error.param
          ? [{ msg: error.message, param: error.param }]
          : undefined,
        error: !error.param ? error.message : undefined,
      });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.code === 11000 && error.keyPattern && error.keyPattern.slug) {
      return res.status(409).json({
        success: false,
        error: "Updating this note would result in a duplicate URL slug. Please modify the title or slug slightly.",
      });
    }
    console.error("Error in /updatenote:", error.message);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

async function deleteNote(req, res) {
  try {
    const deletedNote = await notesService.deleteNote(req.params.id);
    res.json({ success: true, note: deletedNote });
  } catch (error) {
    console.error("Error in /deletenote:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function paginatedNotes(req, res) {
  try {
    const { lastId, categoryIdOrSlug } = req.query;
    const limit = parseInt(req.query.limit) || 9;

    const result = await notesService.getPaginatedNotes({ lastId, categoryIdOrSlug, limit });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ success: false, error: err.message });
    console.error("Error in fetchNextNote:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

async function featuredBatch(req, res) {
  try {
    const { lastId } = req.query;
    const limit = parseInt(req.query.limit) || 5;

    const result = await notesService.getFeaturedBatch({ lastId, limit });
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ success: false, error: err.message });
    console.error("Error fetching featured notes batch:", err);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

async function featured(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 3;
    const featuredNotes = await notesService.getFeaturedNotes(limit);
    res.json({ success: true, notes: featuredNotes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
}

async function search(req, res) {
  try {
    const searchQuery = req.query.query;
    const limit = parseInt(req.query.limit) || 20;
    if (!searchQuery || typeof searchQuery !== "string" || searchQuery.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Search query parameter is required and must be a non-empty string.",
      });
    }
    const notes = await notesService.searchNotes(searchQuery, limit);
    res.json({ success: true, notes });
  } catch (err) {
    console.error("Search Error:", err.message);
    res.status(500).send("Internal Server Error");
  }
}

async function recent(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const recentNotes = await notesService.getRecentNotes(limit);
    res.json({ success: true, notes: recentNotes });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
}

async function byCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const { lastId } = req.query;
    const limit = parseInt(req.query.limit) || 9;

    const result = await notesService.getNotesByCategory({ categoryId, lastId, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, error: error.message });
    if (error.statusCode === 404) return res.status(404).json({ success: false, error: error.message });
    console.error("Error fetching notes by category:", error);
    res.status(500).json({ success: false, error: "Server Error fetching notes by category" });
  }
}

async function byCategoryTitles(req, res) {
  try {
    const { categoryId } = req.params;
    const notes = await notesService.getNotesByCategoryTitles(categoryId);
    res.json({ success: true, notes });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, error: error.message });
    if (error.statusCode === 404) return res.status(404).json({ success: false, error: error.message });
    console.error("Error fetching note titles by category:", error);
    res.status(500).json({ success: false, error: "Server Error fetching note titles" });
  }
}

async function deleteByCategory(req, res) {
  try {
    const { categoryId } = req.params;
    const { deletedCount, categoryName } = await notesService.deleteNotesByCategory(categoryId);

    if (deletedCount === 0) {
      return res.json({
        success: true,
        message: `No notes found in category '${categoryName}' to delete.`,
        deletedCount: 0,
      });
    }

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} note(s) from category '${categoryName}'.`,
      deletedCount,
    });
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, error: error.message });
    if (error.statusCode === 404) return res.status(404).json({ success: false, error: error.message });
    console.error("Error deleting notes by category:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

module.exports = {
  getNote,
  getNoteBySlug,
  getAllNotes,
  getUserNotes,
  addNote,
  updateNote,
  deleteNote,
  paginatedNotes,
  featuredBatch,
  featured,
  search,
  recent,
  byCategory,
  byCategoryTitles,
  deleteByCategory,
};
