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

  const user = await User.findByIdAndUpdate(
    req.userId,
    { fullName, phone, notifications },
    { new: true }
  ).select("-password");

  res.json(user);
});

module.exports = router;
