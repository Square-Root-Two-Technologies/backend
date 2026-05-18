const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const fetchuser = require("../middleware/fetchuser");
const upload = require("../middleware/upload");
const authController = require("../controllers/auth.controller");

// Test endpoint
router.get("/", (req, res) => {
  console.log("hello you have reached the offices of square root two technologies");
});

// POST /api/auth/createuser — register
router.post(
  "/createuser",
  [
    body("name", "Enter a valid name").isLength({ min: 3 }),
    body("email", "Enter a valid email").isEmail(),
    body("password", "Password must be atleast 5 characters").isLength({ min: 5 }),
    body("country", "Enter a valid country").isLength({ min: 2 }),
    body("city", "Enter a valid city").isLength({ min: 1 }),
    body("about"),
  ],
  authController.register,
);

// POST /api/auth/login — login
router.post(
  "/login",
  [
    body("email", "Enter a valid email").isEmail(),
    body("password", "Password cannot be blank").exists(),
  ],
  authController.login,
);

// POST /api/auth/google-login — Google OAuth login
router.post("/google-login", authController.googleLogin);

// POST /api/auth/getuser — get logged-in user
router.post("/getuser", fetchuser, authController.getUser);

// PUT /api/auth/profile — update profile fields
router.put(
  "/profile",
  fetchuser,
  [
    body("name", "Name must be at least 3 characters").optional().isLength({ min: 3 }),
    body("country", "Country must be at least 2 characters").optional().isLength({ min: 2 }),
    body("city", "City must be at least 1 character").optional().isLength({ min: 1 }),
    body("about", "About must be a string").optional().isString(),
  ],
  authController.updateProfile,
);

// PUT /api/auth/profile/picture — upload profile picture
router.put(
  "/profile/picture",
  fetchuser,
  upload.single("profilePic"),
  authController.uploadProfilePicture,
);

module.exports = router;
