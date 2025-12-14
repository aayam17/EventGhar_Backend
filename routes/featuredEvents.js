const express = require("express");
const router = express.Router();
const FeaturedEvent = require("../models/FeaturedEvent");
const upload = require("../middleware/upload");

/* CREATE / UPDATE FEATURED EVENT */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const data = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      venue: req.body.venue,
      eventDateTime: req.body.eventDateTime,
      expiryDate: req.body.expiryDate,
      isActive: req.body.isActive !== "false",
    };

    if (req.file) data.imageSrc = req.file.path;

    const event = req.body.id
      ? await FeaturedEvent.findByIdAndUpdate(req.body.id, data, { new: true })
      : await FeaturedEvent.create(data);

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET ACTIVE FEATURED EVENTS (AUTO HIDE EXPIRED) */
router.get("/", async (req, res) => {
  const now = new Date();

  const events = await FeaturedEvent.find({
    isActive: true,
    $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
  }).sort({ order: 1 });

  res.json(events);
});

/* ENABLE / DISABLE FEATURED */
router.patch("/:id/toggle", async (req, res) => {
  const event = await FeaturedEvent.findById(req.params.id);
  event.isActive = !event.isActive;
  await event.save();
  res.json(event);
});

/* DRAG & DROP REORDER */
router.post("/reorder", async (req, res) => {
  const updates = req.body; // [{id, order}]

  const bulk = updates.map((e) => ({
    updateOne: {
      filter: { _id: e.id },
      update: { order: e.order },
    },
  }));

  await FeaturedEvent.bulkWrite(bulk);
  res.json({ success: true });
});

/* DELETE */
router.delete("/:id", async (req, res) => {
  await FeaturedEvent.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
