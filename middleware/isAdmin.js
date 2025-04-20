// middleware/isAdmin.js
const User = require("../models/User"); // Adjust path if necessary

const isAdmin = async (req, res, next) => {
  // Assumes fetchuser middleware has run and set req.user.id
  if (!req.user || !req.user.id) {
    return res
      .status(401)
      .json({ success: false, error: "Authentication required." });
  }

  try {
    const user = await User.findById(req.user.id).select("role");
    if (!user) {
      return res.status(401).json({ success: false, error: "User not found." });
    }

    if (user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, error: "Forbidden: Admin access required." });
    }

    // Attach the requesting user's role for convenience in subsequent routes if needed
    req.requestingUserRole = user.role;
    next(); // User is admin, proceed
  } catch (error) {
    console.error("Error in isAdmin middleware:", error);
    res
      .status(500)
      .json({ success: false, error: "Server error checking user role." });
  }
};

module.exports = isAdmin;
