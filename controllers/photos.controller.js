const photosService = require("../services/photos.service");

const getPhotos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const result = await photosService.listPhotos({ page, limit, publicOnly: true });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch photos" });
  }
};

const getRecentPhotos = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const photos = await photosService.getRecentPhotos(limit);
    res.json({ success: true, photos });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch recent photos" });
  }
};

const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No image file provided" });
    const photo = await photosService.createPhoto({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      userId: req.user.id,
      metadata: req.body,
    });
    res.status(201).json({ success: true, photo });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({ success: false, error: "Failed to upload photo" });
  }
};

const deletePhoto = async (req, res) => {
  try {
    const requestingUser = req._requestingUser;
    await photosService.deletePhoto(req.params.id, req.user.id, requestingUser?.role);
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};

const updatePhoto = async (req, res) => {
  try {
    const requestingUser = req._requestingUser;
    const photo = await photosService.updatePhoto(req.params.id, req.user.id, requestingUser?.role, req.body);
    res.json({ success: true, photo });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
};

module.exports = { getPhotos, getRecentPhotos, uploadPhoto, deletePhoto, updatePhoto };
