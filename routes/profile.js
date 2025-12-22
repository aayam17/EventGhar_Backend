const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/* ================= AUTH MIDDLEWARE ================= */
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

/* ================= GET PROFILE ================= */
router.get("/", auth, async (req, res) => {
  const user = await User.findById(req.userId).select("-password");
  res.json(user);
});

/* ================= UPDATE PROFILE ================= */
router.put("/", auth, async (req, res) => {
  const { fullName, phone, notifications } = req.body;

  const user = await User.findByIdAndUpdate(
    req.userId,
    {
      fullName,
      phone,
      notifications,
    },
    { new: true }
  ).select("-password");

  res.json(user);
});

module.exports = router;
