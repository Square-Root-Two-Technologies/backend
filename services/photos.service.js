const Photo = require("../models/Photo");
const cloudinary = require("../config/cloudinary");

const listPhotos = async ({ page = 1, limit = 12, publicOnly = true } = {}) => {
  const query = publicOnly ? { isPublic: true } : {};
  const skip = (page - 1) * limit;
  const [photos, total] = await Promise.all([
    Photo.find(query).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    Photo.countDocuments(query),
  ]);
  return { photos, total, hasMore: skip + photos.length < total };
};

const getRecentPhotos = async (limit = 6) => {
  return Photo.find({ isPublic: true }).sort({ date: -1 }).limit(limit).lean();
};

const createPhoto = async ({ buffer, mimetype, userId, metadata = {} }) => {
  const uploadResult = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "photography",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
        overwrite: false,
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

  const photo = new Photo({
    cloudinaryPublicId: uploadResult.public_id,
    url: uploadResult.secure_url,
    width: uploadResult.width,
    height: uploadResult.height,
    uploadedBy: userId,
    title: metadata.title || "",
    caption: metadata.caption || "",
    location: metadata.location || "",
    tags: metadata.tags ? metadata.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    isPublic: metadata.isPublic !== "false",
    dateTaken: metadata.dateTaken ? new Date(metadata.dateTaken) : null,
  });

  await photo.save();
  return photo;
};

const deletePhoto = async (photoId, userId, userRole) => {
  const photo = await Photo.findById(photoId);
  if (!photo) throw Object.assign(new Error("Photo not found"), { statusCode: 404 });
  const isOwner = photo.uploadedBy.toString() === userId.toString();
  const isAdmin = ["admin", "SuperAdmin"].includes(userRole);
  if (!isOwner && !isAdmin) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  await cloudinary.uploader.destroy(photo.cloudinaryPublicId);
  await Photo.findByIdAndDelete(photoId);
};

const updatePhoto = async (photoId, userId, userRole, fields) => {
  const photo = await Photo.findById(photoId);
  if (!photo) throw Object.assign(new Error("Photo not found"), { statusCode: 404 });
  const isOwner = photo.uploadedBy.toString() === userId.toString();
  const isAdmin = ["admin", "SuperAdmin"].includes(userRole);
  if (!isOwner && !isAdmin) throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  const allowed = ["title", "caption", "location", "tags", "isPublic", "dateTaken"];
  allowed.forEach((key) => { if (fields[key] !== undefined) photo[key] = fields[key]; });
  await photo.save();
  return photo;
};

module.exports = { listPhotos, getRecentPhotos, createPhoto, deletePhoto, updatePhoto };
