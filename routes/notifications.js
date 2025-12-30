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
  await Notification.findByIdAndUpdate(req.params.id, {
    isRead: true,
  });
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
