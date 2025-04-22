// middleware/isSuperAdmin.js
const User = require("../models/User");

const isSuperAdmin = async (req, res, next) => {
  // Assumes fetchuser middleware has already run and set req.user
  if (!req.user || !req.user.id) {
    return res
      .status(401)
      .json({ success: false, error: "Authentication required." });
  }

  try {
    // Fetch user details specifically for role check if not already populated fully
    // If fetchuser only provides ID, fetch role here. If fetchuser provides role, use that.
    const user = await User.findById(req.user.id).select("role email"); // Select email for logging
    if (!user) {
      return res.status(401).json({ success: false, error: "User not found." });
    }

    // Strict check for 'SuperAdmin' role
    if (user.role !== "SuperAdmin") {
      console.warn(
        `Access denied for user ${user.email} (Role: ${user.role}) to SuperAdmin route.`,
      );
      return res.status(403).json({
        success: false,
        error: "Forbidden: SuperAdmin access required.",
      });
    }

    // Attach role for potential downstream use if needed (optional)
    req.requestingUserRole = user.role;
    next(); // User is SuperAdmin, proceed
  } catch (error) {
    console.error("Error in isSuperAdmin middleware:", error);
    res
      .status(500)
      .json({ success: false, error: "Server error checking user role." });
  }
};

module.exports = isSuperAdmin;
