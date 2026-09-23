const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Order = require("../models/Order");

/* AUTH */
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
};

/* ================= PROFILE ================= */
router.get("/", auth, async (req, res) => {
  const user = await User.findById(req.userId).select("-password");
  res.json(user);
});

/* ================= MY TICKETS (PURCHASED) ================= */
router.get("/my-tickets", auth, async (req, res) => {
  const tickets = await Order.find({
    "user.id": req.userId,
    isGifted: false,
    "payment.status": "PAID",
  }).sort({ createdAt: -1 });

  res.json(tickets);
});

/* ================= GIFTED TICKETS ================= */
router.get("/gifted-tickets", auth, async (req, res) => {
  const tickets = await Order.find({
    "user.id": req.userId,
    isGifted: true,
    "payment.status": "PAID",
  }).sort({ createdAt: -1 });

  res.json(tickets);
});

/* ================= UPDATE PROFILE ================= */
router.put("/", auth, async (req, res) => {
  const { fullName, phone, notifications } = req.body;

  // Only accept known fields, and never blank out a required one
  const update = {};
  if (typeof fullName === "string") {
    if (!fullName.trim()) {
      return res.status(400).json({ message: "Name can't be empty" });
    }
    update.fullName = fullName.trim();
  }
  if (typeof phone === "string") {
    if (!phone.trim()) {
      return res.status(400).json({ message: "Phone number can't be empty" });
    }
    update.phone = phone.trim();
  }
  if (notifications && typeof notifications.email === "boolean") {
    update["notifications.email"] = notifications.email;
  }

  const user = await User.findByIdAndUpdate(req.userId, update, {
    new: true,
  }).select("-password");

  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

module.exports = router;
