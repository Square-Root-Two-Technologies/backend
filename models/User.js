// models/User.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  country: {
    type: String,
    required: false,
  },
  city: {
    type: String,
    required: false,
  },
  about: {
    type: String,
    required: false,
    default: "about is empty",
  },
  avatarUrl: {
    type: String,
    required: false,
    default: null,
  },
  role: {
    type: String,
    required: true,
    enum: ["user", "admin"], // Define possible roles
    default: "user", // Default role for new users
  },
});
const User = mongoose.model("user", UserSchema);
module.exports = User;
