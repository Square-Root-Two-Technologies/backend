// config/cloudinary.js
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" }); // Adjust path if necessary

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use HTTPS
});

console.log("Cloudinary Configured:", !!process.env.CLOUDINARY_CLOUD_NAME); // Basic check

module.exports = cloudinary;
