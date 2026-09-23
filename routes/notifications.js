const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

/* GET USER NOTIFICATIONS */
router.get("/", auth, async (req, res) => {
  const notifications = await Notification.find({
    userId: req.userId,
  }).sort({ createdAt: -1 });

  res.json(notifications);
});

/* MARK AS READ */
router.post("/:id/read", auth, async (req, res) => {
  const updated = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { isRead: true }
  );
  if (!updated) return res.status(404).json({ message: "Not found" });
  res.json({ success: true });
});

/* MARK ALL READ */
router.post("/read-all", auth, async (req, res) => {
  await Notification.updateMany(
    { userId: req.userId, isRead: false },
    { isRead: true }
  );
  res.json({ success: true });
});

module.exports = router;
