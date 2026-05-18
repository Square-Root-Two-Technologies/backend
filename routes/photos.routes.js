const express = require("express");
const router = express.Router();
const fetchuser = require("../middleware/fetchuser");
const isAdmin = require("../middleware/isAdmin");
const upload = require("../middleware/upload");
const User = require("../models/User");
const photosController = require("../controllers/photos.controller");

// Attach requesting user role to req for controller use
const attachUserRole = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("role").lean();
    req._requestingUser = user;
    next();
  } catch (err) {
    next(err);
  }
};

// GET /api/photos — public paginated list
router.get("/", photosController.getPhotos);

// GET /api/photos/recent — public recent photos for landing page
router.get("/recent", photosController.getRecentPhotos);

// POST /api/photos — upload (admin/SuperAdmin only)
router.post("/", fetchuser, isAdmin, upload.single("photo"), photosController.uploadPhoto);

// PUT /api/photos/:id — update metadata (admin/SuperAdmin only)
router.put("/:id", fetchuser, isAdmin, attachUserRole, photosController.updatePhoto);

// DELETE /api/photos/:id — delete (admin/SuperAdmin only)
router.delete("/:id", fetchuser, isAdmin, attachUserRole, photosController.deletePhoto);

module.exports = router;
