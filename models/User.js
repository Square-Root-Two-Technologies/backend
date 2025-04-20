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
    lowercase: true, // Ensure email is stored consistently
    trim: true,
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
    select: false,
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
  role: {
    type: String,
    required: true,
    enum: ["user", "admin"], // Define possible roles
    default: "user", // Default role for new users
  },
  profilePictureUrl: {
    type: String,
    default: null,
  },
  profilePicturePublicId: {
    type: String,
    default: null,
  },
  googleId: {
    type: String,
    unique: true, // Ensure only one user per Google ID
    sparse: true,
  },
});

UserSchema.methods.toJSON = function () {
  var obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("user", UserSchema);
module.exports = User;
