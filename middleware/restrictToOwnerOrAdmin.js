const mongoose = require("mongoose");
const Note = require("../models/Note");
const User = require("../models/User");

const restrictToOwnerOrAdmin = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid Note ID" });
  }
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ error: "Not Found" });

  const user = await User.findById(req.user.id).select("role");
  if (!user) return res.status(401).json({ error: "User not found" });

  if (note.user.toString() !== req.user.id && user.role !== "admin") {
    return res.status(401).json({ error: "Not Allowed" });
  }

  req.note = note; // Pass note to next middleware
  req.requestingUser = user; // Pass user for role checks
  next();
};

module.exports = restrictToOwnerOrAdmin;
