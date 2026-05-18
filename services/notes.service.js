const mongoose = require("mongoose");
const slugify = require("slugify");
const Note = require("../models/Note");
const Category = require("../models/Category");
const User = require("../models/User");

// --- Helper: fetch ancestor path for a category ---
async function getCategoryAncestors(categoryId) {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    return [];
  }
  let ancestors = [];
  let currentId = categoryId;
  try {
    while (currentId) {
      const category = await Category.findById(currentId)
        .select("_id name parent")
        .lean();
      if (!category) break;
      ancestors.unshift({ _id: category._id, name: category.name });
      currentId = category.parent;
    }
  } catch (err) {
    console.error("Error fetching ancestors for category", categoryId, err);
    return ancestors;
  }
  return ancestors;
}

// --- Helper: generate a unique slug ---
async function generateUniqueSlug(title) {
  let baseSlug = slugify(title, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });
  if (!baseSlug) baseSlug = `note-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;
  let existingNote = await Note.findOne({ slug });
  while (existingNote) {
    counter++;
    slug = `${baseSlug}-${counter}`;
    console.log(`Slug collision detected for '${baseSlug}'. Trying new slug: ${slug}`);
    existingNote = await Note.findOne({ slug });
  }
  console.log(`Final generated slug for note '${title}': ${slug}`);
  return slug;
}

async function getNoteById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const err = new Error("Invalid Note ID format");
    err.statusCode = 400;
    throw err;
  }
  const note = await Note.findById(id)
    .populate("user", "name  _id role profilePictureUrl")
    .populate("category", "name");
  if (!note) {
    const err = new Error("Note not found");
    err.statusCode = 404;
    throw err;
  }
  return note;
}

async function getNoteBySlug(slug) {
  const note = await Note.findOne({ slug })
    .populate("user", "name _id role profilePictureUrl")
    .populate("category", "name parent _id");

  if (!note) {
    console.warn(`Note not found with slug: ${slug}`);
    const err = new Error("Note not found");
    err.statusCode = 404;
    throw err;
  }

  let ancestorPath = [];
  if (note.category && note.category._id) {
    ancestorPath = await getCategoryAncestors(note.category._id);
  }

  const noteObject = note.toObject();
  noteObject.ancestorPath = ancestorPath;
  console.log(`Note found by slug ${slug}: ${note.title}`);
  return noteObject;
}

async function getAllNotes() {
  return Note.find({})
    .populate("user", "name")
    .populate("category", "name")
    .sort({ date: -1 });
}

async function getUserNotes(userId, userRole) {
  const populateFields = [
    { path: "user", select: "name email profilePictureUrl" },
    { path: "category", select: "name" },
  ];
  const adminRoles = ["admin", "SuperAdmin"];
  if (adminRoles.includes(userRole)) {
    console.log("Fetching all notes for admin user:", userId);
    return Note.find({}).populate(populateFields).sort({ date: -1 });
  }
  console.log("Fetching notes for regular user:", userId);
  return Note.find({ user: userId }).populate(populateFields).sort({ date: -1 });
}

async function addNote({ title, description, tag, categoryId, isFeatured, userId, userRole }) {
  const categoryExists = await Category.findById(categoryId);
  if (!categoryExists) {
    const err = new Error("Selected category does not exist");
    err.statusCode = 400;
    err.param = "category";
    throw err;
  }

  const adminRoles = ["admin", "SuperAdmin"];
  if (isFeatured && !adminRoles.includes(userRole)) {
    isFeatured = false;
  }

  const slug = await generateUniqueSlug(title);

  const note = new Note({
    title,
    slug,
    description,
    tag: tag || "General",
    category: categoryId,
    isFeatured,
    user: userId,
  });

  const savedNote = await note.save();

  return Note.findById(savedNote._id)
    .populate("user", "name email profilePictureUrl")
    .populate("category", "name");
}

async function updateNote({ noteToUpdate, noteId, body, requestingUserRole }) {
  const { title, description, tag, category: categoryId } = body;
  let clientIsFeatured = body.isFeatured;

  const updateFields = {};

  if (title !== undefined && title !== noteToUpdate.title) {
    updateFields.title = title;
  }
  if (description !== undefined) {
    updateFields.description = description;
    const words = description.split(/\s+/).filter(Boolean).length;
    const wordsPerMinute = 200;
    updateFields.readTimeMinutes = Math.max(1, Math.ceil(words / wordsPerMinute));
  }
  if (tag !== undefined) updateFields.tag = tag;

  if (categoryId !== undefined && categoryId !== noteToUpdate.category.toString()) {
    const categoryExists = await Category.findById(categoryId);
    if (!categoryExists) {
      const err = new Error("Selected category does not exist");
      err.statusCode = 400;
      err.param = "category";
      throw err;
    }
    updateFields.category = categoryId;
  }

  const adminRoles = ["admin", "SuperAdmin"];
  if (clientIsFeatured !== undefined && adminRoles.includes(requestingUserRole)) {
    updateFields.isFeatured = clientIsFeatured;
  } else if (clientIsFeatured !== undefined && !adminRoles.includes(requestingUserRole)) {
    console.warn(
      `Non-admin/superadmin user tried to change isFeatured on update for note ${noteId}. Ignoring.`,
    );
  }

  if (Object.keys(updateFields).length === 0) {
    const err = new Error("No valid fields provided for update");
    err.statusCode = 400;
    throw err;
  }

  const updatedNote = await Note.findByIdAndUpdate(
    noteId,
    { $set: updateFields },
    { new: true, runValidators: true },
  )
    .populate("user", "name email profilePictureUrl")
    .populate("category", "name ");

  if (!updatedNote) {
    const err = new Error("Note not found after update attempt.");
    err.statusCode = 404;
    throw err;
  }

  return updatedNote;
}

async function deleteNote(noteId) {
  return Note.findByIdAndDelete(noteId);
}

async function getPaginatedNotes({ lastId, categoryIdOrSlug, limit = 9 }) {
  let query = {};

  if (categoryIdOrSlug && categoryIdOrSlug !== "all") {
    let categoryFilter = null;
    if (mongoose.Types.ObjectId.isValid(categoryIdOrSlug)) {
      categoryFilter = await Category.findById(categoryIdOrSlug).select("_id");
    } else {
      categoryFilter = await Category.findOne({ slug: categoryIdOrSlug }).select("_id");
    }

    if (categoryFilter) {
      query.category = categoryFilter._id;
    } else {
      console.warn(`Category filter specified (${categoryIdOrSlug}) but not found. Returning empty.`);
      return { notes: [], hasMore: false, nextLastId: null };
    }
  }

  if (lastId) {
    if (!mongoose.Types.ObjectId.isValid(lastId)) {
      const err = new Error("Invalid lastId format");
      err.statusCode = 400;
      throw err;
    }
    query._id = { $lt: lastId };
  }

  const notes = await Note.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("user", "name profilePictureUrl")
    .populate("category", "name");

  const nextLastId = notes.length > 0 ? notes[notes.length - 1]._id : null;

  let hasMore = false;
  if (nextLastId) {
    const remainingCountQuery = { ...query, _id: { $lt: nextLastId } };
    const remainingCount = await Note.countDocuments(remainingCountQuery);
    hasMore = remainingCount > 0;
  }

  return { notes, hasMore, nextLastId };
}

async function getFeaturedBatch({ lastId, limit = 5 }) {
  let query = { isFeatured: true };

  if (lastId) {
    if (!mongoose.Types.ObjectId.isValid(lastId)) {
      const err = new Error("Invalid lastId format");
      err.statusCode = 400;
      throw err;
    }
    query._id = { $lt: lastId };
  }

  const notes = await Note.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("user", "name profilePictureUrl")
    .populate("category", "name ");

  const nextLastId = notes.length > 0 ? notes[notes.length - 1]._id : null;
  let hasMore = false;
  if (nextLastId) {
    const remainingCount = await Note.countDocuments({ isFeatured: true, _id: { $lt: nextLastId } });
    hasMore = remainingCount > 0;
  }

  return { notes, hasMore, nextLastId };
}

async function getFeaturedNotes(limit = 3) {
  return Note.find({ isFeatured: true })
    .populate("user", "name profilePictureUrl")
    .populate("category", "name ")
    .sort({ date: -1 })
    .limit(limit);
}

async function searchNotes(searchQuery, limit = 20) {
  return Note.find({
    $or: [
      { title: { $regex: searchQuery, $options: "i" } },
      { description: { $regex: searchQuery, $options: "i" } },
      { tag: { $regex: searchQuery, $options: "i" } },
    ],
  })
    .populate("user", "name profilePictureUrl")
    .populate("category", "name ")
    .sort({ date: -1 })
    .limit(limit);
}

async function getRecentNotes(limit = 5) {
  return Note.find({})
    .sort({ date: -1 })
    .limit(limit)
    .select("title _id date slug category tag")
    .populate("category", "name ");
}

async function getNotesByCategory({ categoryId, lastId, limit = 9 }) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    const err = new Error("Invalid Category ID format");
    err.statusCode = 400;
    throw err;
  }

  const category = await Category.findById(categoryId).select("_id name");
  if (!category) {
    const err = new Error("Category not found");
    err.statusCode = 404;
    throw err;
  }

  let query = { category: category._id };

  if (lastId) {
    if (!mongoose.Types.ObjectId.isValid(lastId)) {
      const err = new Error("Invalid lastId format");
      err.statusCode = 400;
      throw err;
    }
    query._id = { $lt: lastId };
  }

  const notes = await Note.find(query)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("user", "name profilePictureUrl")
    .populate("category", "name");

  const nextLastId = notes.length > 0 ? notes[notes.length - 1]._id : null;

  let hasMore = false;
  if (nextLastId) {
    const remainingCount = await Note.countDocuments({ category: category._id, _id: { $lt: nextLastId } });
    hasMore = remainingCount > 0;
  }

  console.log(`Category ${categoryId} Notes: Fetched ${notes.length}, HasMore: ${hasMore}, NextLastId: ${nextLastId}`);

  return { notes, category: { name: category.name, _id: category._id }, hasMore, nextLastId };
}

async function getNotesByCategoryTitles(categoryId) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    const err = new Error("Invalid Category ID format");
    err.statusCode = 400;
    throw err;
  }

  const categoryExists = await Category.findById(categoryId).select("_id");
  if (!categoryExists) {
    const err = new Error("Category not found");
    err.statusCode = 404;
    throw err;
  }

  const notes = await Note.find({ category: categoryId })
    .select("_id title slug")
    .sort({ title: 1 })
    .lean();

  console.log(`Workspaceed ${notes.length} note titles for category ${categoryId}`);
  return notes;
}

async function deleteNotesByCategory(categoryId) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    const err = new Error("Invalid Category ID format");
    err.statusCode = 400;
    throw err;
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    const err = new Error("Category not found");
    err.statusCode = 404;
    throw err;
  }

  const result = await Note.deleteMany({ category: categoryId });
  return { deletedCount: result.deletedCount, categoryName: category.name };
}

module.exports = {
  getNoteById,
  getNoteBySlug,
  getAllNotes,
  getUserNotes,
  addNote,
  updateNote,
  deleteNote,
  getPaginatedNotes,
  getFeaturedBatch,
  getFeaturedNotes,
  searchNotes,
  getRecentNotes,
  getNotesByCategory,
  getNotesByCategoryTitles,
  deleteNotesByCategory,
};
