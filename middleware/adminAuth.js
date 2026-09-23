const jwt = require("jsonwebtoken");

/**
 * Guards admin-only routes. The admin login issues a JWT with
 * role: "admin"; the frontend sends it as `Authorization: Bearer <token>`.
 * Regular user tokens are rejected with 403.
 */
module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ message: "Admins only" });
    }

    req.userId = decoded.id;
    req.role = "admin";
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
};
