const express = require("express");
const User = require("../models/User");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var fetchuser = require("../middleware/fetchuser");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");

const dotenv = require("dotenv");
dotenv.config({ path: "../config.env" }); // Add this at the top
const JWT_SECRET = process.env.JWT_SECRET;

//const JWT_SECRET = "Harryisagoodb$oy";

//test
router.get("/", (req, res) => {
  console.log(
    "hello you have reached the offices of square root two technologies",
  );
});

// ROUTE 1: Create a User using: POST "/api/auth/createuser". No login required
router.post(
  "/createuser",
  [
    body("name", "Enter a valid name").isLength({ min: 3 }),
    body("email", "Enter a valid email").isEmail(),
    body("password", "Password must be atleast 5 characters").isLength({
      min: 5,
    }),
    body("country", "Enter a valid country").isLength({ min: 2 }),
    body("city", "Enter a valid city").isLength({ min: 1 }),
    body("about"),
  ],
  async (req, res) => {
    let success = false;
    // If there are errors, return Bad request and the errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success, errors: errors.array() });
    }
    try {
      // Check whether the user with this email exists already
      let user = await User.findOne({ email: req.body.email });
      if (user) {
        return res.status(400).json({
          success,
          error: "Sorry a user with this email already exists",
        });
      }
      const salt = await bcrypt.genSalt(10);
      const secPass = await bcrypt.hash(req.body.password, salt);

      const { name, email, password, country, city, about } = req.body;

      // Create a new user
      user = await User.create({
        name: name,
        password: secPass,
        email: email,
        country: country,
        city: city,
        about: about,
      });
      const data = {
        user: {
          id: user.id,
        },
      };
      const authtoken = jwt.sign(data, JWT_SECRET, { expiresIn: "1h" });

      // res.json(user)
      success = true;
      res.json({ success, authtoken });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal Server Error");
    }
  },
);

// ROUTE 2: Authenticate a User using: POST "/api/auth/login". No login required
router.post(
  "/login",
  [
    body("email", "Enter a valid email").isEmail(),
    body("password", "Password cannot be blank").exists(),
  ],
  async (req, res) => {
    let success = false;
    // If there are errors, return Bad request and the errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
      let user = await User.findOne({ email });
      if (!user) {
        success = false;
        return res
          .status(400)
          .json({ error: "Please try to login with correct credentials" });
      }

      const passwordCompare = await bcrypt.compare(password, user.password);
      if (!passwordCompare) {
        success = false;
        return res.status(400).json({
          success,
          error: "Please try to login with correct credentials",
        });
      } else {
        console.log("true!");
      }

      const data = {
        user: {
          id: user.id,
        },
      };
      const authtoken = jwt.sign(data, JWT_SECRET, { expiresIn: "1h" });
      success = true;
      res.json({ success, authtoken });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Internal Server Error");
    }
  },
);

// ROUTE 3: Get loggedin User Details using: POST "/api/auth/getuser". Login required
router.post("/getuser", fetchuser, async (req, res) => {
  try {
    const userId = req.user.id;
    // CORRECT: Exclude both password and role
    const user = await User.findById(userId).select("-password "); // <--- CHANGE THIS LINE

    if (!user) {
      return res.status(404).send("User not found");
    }
    res.send(user); // User object without password and role
  } catch (error) {
    console.error(error.message); // The error you saw was logged here
    res.status(500).send("Internal Server Error");
  }
});

router.put(
  "/profile", // Using PUT method for update
  fetchuser, // Apply middleware to identify the user
  [
    // Add validations for the fields that can be updated. Use .optional()
    body("name", "Name must be at least 3 characters")
      .optional()
      .isLength({ min: 3 }),
    body("country", "Country must be at least 2 characters")
      .optional()
      .isLength({ min: 2 }),
    body("city", "City must be at least 1 character")
      .optional()
      .isLength({ min: 1 }),
    body("about", "About must be a string").optional().isString(),
    // Do NOT allow updating email or password here. Create separate routes for those actions if needed.
  ],
  async (req, res) => {
    // 1. Handle Validation Errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      // 2. Get User ID from middleware
      const userId = req.user.id;

      // 3. Construct Update Object with provided fields
      const { name, country, city, about } = req.body;
      const updatedFields = {};

      // Only add fields to the update object if they were provided in the request body
      if (name !== undefined) updatedFields.name = name;
      if (country !== undefined) updatedFields.country = country;
      if (city !== undefined) updatedFields.city = city;
      if (about !== undefined) updatedFields.about = about;

      // Check if there's anything to update
      if (Object.keys(updatedFields).length === 0) {
        return res.status(400).json({ error: "No update fields provided" });
      }

      // 4. Find User and Update using findByIdAndUpdate
      const updatedUser = await User.findByIdAndUpdate(
        userId, // Find user by ID from token
        { $set: updatedFields }, // Apply the updates
        { new: true }, // Return the modified document instead of the original
      ).select("-password"); // Exclude the password field from the result

      // 5. Handle User Not Found (though unlikely if token is valid)
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // 6. Send Success Response
      res.status(200).json({ success: true, user: updatedUser });
    } catch (error) {
      // 7. Handle Server Errors
      console.error("Error updating profile:", error.message);
      res.status(500).send("Internal Server Error");
    }
  },
);

// --- New Endpoint for Profile Picture Upload ---
router.put(
  "/profile/picture",
  fetchuser, // Ensure user is logged in
  upload.single("profilePic"), // Use multer for single file upload named 'profilePic'
  async (req, res) => {
    try {
      const userId = req.user.id;

      // 1. Check if file exists
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No image file uploaded." });
      }

      // 2. Find the user to get the old public_id (if exists)
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, error: "User not found." });
      }

      // 3. Upload to Cloudinary using upload_stream
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `profile_pictures/${userId}`, // Optional: Organize uploads
          public_id: `user_${userId}_avatar`, // Consistent public_id for easy replacement
          overwrite: true, // Overwrite if public_id already exists
          format: "webp", // Convert to webp for optimization
          transformation: [
            // Optional: Resize image
            { width: 200, height: 200, crop: "fill", gravity: "face" },
          ],
        },
        async (error, result) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            return res.status(500).json({
              success: false,
              error: "Failed to upload image to cloud.",
            });
          }

          if (!result) {
            console.error(
              "Cloudinary upload error: No result object returned.",
            );
            return res.status(500).json({
              success: false,
              error: "Cloud upload failed unexpectedly.",
            });
          }

          // 4. (Optional but recommended) Delete old image if it existed and ID is different
          //    Note: With overwrite: true and consistent public_id, this might be redundant,
          //    but good practice if public_id strategy changes.
          // if (user.profilePicturePublicId && user.profilePicturePublicId !== result.public_id) {
          //     try {
          //         await cloudinary.uploader.destroy(user.profilePicturePublicId);
          //         console.log("Deleted old profile pic:", user.profilePicturePublicId);
          //     } catch (deleteError) {
          //         console.error("Failed to delete old Cloudinary image:", deleteError);
          //         // Don't block update if deletion fails, just log it
          //     }
          // }

          // 5. Update User document in MongoDB
          user.profilePictureUrl = result.secure_url;
          user.profilePicturePublicId = result.public_id;
          await user.save();

          // 6. Return updated user info (excluding password)
          const updatedUserInfo = await User.findById(userId).select(
            "-password",
          );
          res.status(200).json({ success: true, user: updatedUserInfo });
        },
      );

      // Pipe the buffer from multer into the Cloudinary upload stream
      uploadStream.end(req.file.buffer);
    } catch (error) {
      console.error("Error in /profile/picture:", error);
      // Handle specific multer errors (like file size)
      if (error instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          error: `File upload error: ${error.message}`,
        });
      }
      // Handle custom file filter error
      if (error.message === "Not an image! Please upload only images.") {
        return res.status(400).json({ success: false, error: error.message });
      }
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  },
);

module.exports = router;
