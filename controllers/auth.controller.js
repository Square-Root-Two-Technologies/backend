const { validationResult } = require("express-validator");
const authService = require("../services/auth.service");

async function register(req, res) {
  let success = false;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success, errors: errors.array() });
  }
  try {
    const { name, email, password, country, city, about } = req.body;
    const result = await authService.createUser({ name, email, password, country, city, about });
    success = true;
    res.json({ success, authtoken: result.authtoken });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Error in /createuser:", error);
    res.status(500).send("Internal Server Error");
  }
}

async function login(req, res) {
  let success = false;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  try {
    const result = await authService.loginUser({ email, password });
    success = true;
    res.json({ success, authtoken: result.authtoken });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success, error: error.message });
    }
    console.error("Error in /login:", error);
    res.status(500).send("Internal Server Error");
  }
}

async function forgotPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    await authService.requestPasswordReset(req.body.email);
    // Always return the same generic message, whether or not the email exists.
    res.json({
      success: true,
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Error in /forgot-password:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

async function resetPassword(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    await authService.resetPassword(req.params.token, req.body.password);
    res.json({ success: true, message: "Password updated. You can now log in." });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, error: error.message });
    }
    console.error("Error in /reset-password:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

async function googleLogin(req, res) {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: "ID token is required." });
  }
  try {
    const result = await authService.googleLoginUser(token);
    res.json({ success: true, authtoken: result.authtoken });
  } catch (error) {
    console.error("Google login verification error:", error);
    if (
      error.message.includes("Invalid token signature") ||
      error.message.includes("Token used too late") ||
      error.message.includes("Invalid Google token payload")
    ) {
      return res.status(401).json({ success: false, error: "Invalid or expired Google token." });
    } else if (error.message.includes("Email not found")) {
      return res.status(400).json({ success: false, error: "Could not retrieve email from Google token." });
    } else if (error.statusCode === 500) {
      return res.status(500).json({ success: false, error: error.message });
    } else {
      return res.status(500).json({ success: false, error: "Internal server error during Google authentication." });
    }
  }
}

async function getUser(req, res) {
  try {
    const user = await authService.getUserById(req.user.id);
    res.send(user);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).send("User not found");
    }
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
}

async function updateProfile(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const userId = req.user.id;
    const { name, country, city, about } = req.body;
    const updatedUser = await authService.updateUserProfile(userId, { name, country, city, about });
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    console.error("Error updating profile:", error.message);
    res.status(500).send("Internal Server Error");
  }
}

async function uploadProfilePicture(req, res) {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image file uploaded." });
    }

    const updatedUserInfo = await authService.uploadProfilePic(userId, req.file.buffer);
    res.status(200).json({ success: true, user: updatedUserInfo });
  } catch (error) {
    console.error("Error in /profile/picture:", error);
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, error: error.message });
    }
    if (error.statusCode === 500) {
      return res.status(500).json({ success: false, error: error.message });
    }
    // Handle multer errors passed from middleware
    if (error.code && error.code.startsWith("LIMIT_")) {
      return res.status(400).json({ success: false, error: `File upload error: ${error.message}` });
    }
    if (error.message === "Not an image! Please upload only images.") {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

module.exports = {
  register,
  login,
  googleLogin,
  getUser,
  updateProfile,
  uploadProfilePicture,
  forgotPassword,
  resetPassword,
};
