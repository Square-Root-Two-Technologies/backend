// config/cloudinary.js
const cloudinary = require("cloudinary").v2;
const config = require("./index");

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true, // Use HTTPS
});

console.log("Cloudinary Configured:", !!config.cloudinary.cloudName); // Basic check

module.exports = cloudinary;
