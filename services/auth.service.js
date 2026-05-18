const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const cloudinary = require("../config/cloudinary");
const config = require("../config/index");

const JWT_SECRET = config.jwtSecret;
const GOOGLE_CLIENT_ID = config.googleClientId;

if (!GOOGLE_CLIENT_ID) {
  console.error("FATAL ERROR: GOOGLE_CLIENT_ID is not defined in config.env");
}
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Create a new user, hash their password, return a signed JWT.
 */
async function createUser({ name, email, password, country, city, about }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const err = new Error("Sorry a user with this email already exists");
    err.statusCode = 400;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const secPass = await bcrypt.hash(password, salt);

  const user = await User.create({ name, password: secPass, email, country, city, about });

  const authtoken = jwt.sign({ user: { id: user.id } }, JWT_SECRET, { expiresIn: "1h" });
  return { authtoken };
}

/**
 * Verify credentials and return a signed JWT.
 */
async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    const err = new Error("Please try to login with correct credentials");
    err.statusCode = 400;
    throw err;
  }

  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    console.log("true!"); // preserve original log on success path
    const err = new Error("Please try to login with correct credentials");
    err.statusCode = 400;
    throw err;
  }

  console.log("true!"); // original code logged this on match
  const authtoken = jwt.sign({ user: { id: user.id } }, JWT_SECRET, { expiresIn: "1h" });
  return { authtoken };
}

/**
 * Verify Google ID token, upsert user, return a signed JWT.
 */
async function googleLoginUser(token) {
  if (!GOOGLE_CLIENT_ID) {
    const err = new Error("Server configuration error.");
    err.statusCode = 500;
    throw err;
  }

  const ticket = await client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();

  if (!payload) {
    throw new Error("Invalid Google token payload");
  }

  const googleUserId = payload["sub"];
  const email = payload["email"];
  const name = payload["name"];
  const picture = payload["picture"];

  if (!email) {
    throw new Error("Email not found in Google token payload");
  }

  let user = await User.findOne({ email });

  if (user) {
    let needsSave = false;
    if (!user.googleId) { user.googleId = googleUserId; needsSave = true; }
    if (picture && (!user.profilePictureUrl || user.profilePictureUrl !== picture)) {
      user.profilePictureUrl = picture;
      needsSave = true;
    }
    if (name && user.name !== name) { user.name = name; needsSave = true; }
    if (needsSave) {
      await user.save();
      console.log(`Updated existing user ${email} during Google login.`);
    }
    console.log(`Existing user ${email} logged in via Google.`);
  } else {
    user = new User({
      googleId: googleUserId,
      email,
      name,
      profilePictureUrl: picture,
      role: "user",
    });
    await user.save();
    console.log(`New user ${email} created via Google Sign-In.`);
  }

  const authtoken = jwt.sign({ user: { id: user.id } }, JWT_SECRET, { expiresIn: "1h" });
  return { authtoken };
}

/**
 * Fetch a user by ID, excluding password.
 */
async function getUserById(userId) {
  const user = await User.findById(userId).select("-password");
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }
  return user;
}

/**
 * Update editable profile fields for a user.
 */
async function updateUserProfile(userId, fields) {
  const { name, country, city, about } = fields;
  const updatedFields = {};
  if (name !== undefined) updatedFields.name = name;
  if (country !== undefined) updatedFields.country = country;
  if (city !== undefined) updatedFields.city = city;
  if (about !== undefined) updatedFields.about = about;

  if (Object.keys(updatedFields).length === 0) {
    const err = new Error("No update fields provided");
    err.statusCode = 400;
    throw err;
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updatedFields },
    { new: true },
  ).select("-password");

  if (!updatedUser) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  return updatedUser;
}

/**
 * Upload a profile picture buffer to Cloudinary, update the User document.
 * Returns a Promise that resolves with the updated user.
 */
function uploadProfilePic(userId, fileBuffer) {
  return new Promise(async (resolve, reject) => {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const err = new Error("User not found.");
        err.statusCode = 404;
        return reject(err);
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `profile_pictures/${userId}`,
          public_id: `user_${userId}_avatar`,
          overwrite: true,
          format: "webp",
          transformation: [
            { width: 200, height: 200, crop: "fill", gravity: "face" },
          ],
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            const err = new Error("Failed to upload image to cloud.");
            err.statusCode = 500;
            return reject(err);
          }
          if (!result) {
            console.error("Cloudinary upload error: No result object returned.");
            const err = new Error("Cloud upload failed unexpectedly.");
            err.statusCode = 500;
            return reject(err);
          }

          user.profilePictureUrl = result.secure_url;
          user.profilePicturePublicId = result.public_id;
          await user.save();

          const updatedUserInfo = await User.findById(userId).select("-password");
          resolve(updatedUserInfo);
        },
      );

      uploadStream.end(fileBuffer);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { createUser, loginUser, googleLoginUser, getUserById, updateUserProfile, uploadProfilePic };
