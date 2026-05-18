const mongoose = require("mongoose");
const { Schema } = mongoose;

const PhotoSchema = new Schema({
  cloudinaryPublicId: { type: String, required: true },
  url: { type: String, required: true },
  title: { type: String, trim: true, default: "" },
  caption: { type: String, trim: true, default: "" },
  location: { type: String, trim: true, default: "" },
  tags: [{ type: String, trim: true }],
  width: { type: Number },
  height: { type: Number },
  isPublic: { type: Boolean, default: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  dateTaken: { type: Date },
  date: { type: Date, default: Date.now },
});

PhotoSchema.index({ date: -1 });
PhotoSchema.index({ isPublic: 1, date: -1 });

module.exports = mongoose.model("Photo", PhotoSchema);
