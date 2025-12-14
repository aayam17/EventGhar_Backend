const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const upload = require("../middleware/upload");

// CREATE EVENT
router.post("/", upload.single("image"), async (req, res) => {
  console.log("FILE:", req.file);

  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image upload failed" });
    }

    const event = new Event({
      title: req.body.title,
      formattedDate: req.body.formattedDate,
      price: Number(req.body.price),
      formattedPrice: req.body.formattedPrice,
      packages: req.body.packages,
      imageSrc: req.file.path,
    });

    await event.save();
    res.status(201).json(event);
  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET EVENTS
router.get("/", async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE EVENT
router.delete("/:id", async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
