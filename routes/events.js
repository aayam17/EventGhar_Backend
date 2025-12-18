const express = require("express");
const router = express.Router();
const Event = require("../models/Event");
const upload = require("../middleware/upload");

/* =====================================================
   CREATE EVENT
===================================================== */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    // 🛑 Safety check
    if (!req.file) {
      return res.status(400).json({ error: "Image is required" });
    }

    const event = new Event({
      // BASIC INFO
      title: req.body.title,
      formattedDate: req.body.formattedDate,
      price: Number(req.body.price),
      formattedPrice: req.body.formattedPrice,
      packages: req.body.packages,

      // IMAGE
      imageSrc: req.file.path,

      // DETAILS PAGE DATA
      description: req.body.description || "",
      time: req.body.time || "",

      organizer: req.body.organizer
        ? JSON.parse(req.body.organizer)
        : {},

      venue: req.body.venue
        ? JSON.parse(req.body.venue)
        : {},

      tickets: req.body.tickets
        ? JSON.parse(req.body.tickets)
        : [],
    });

    await event.save();
    res.status(201).json(event);
  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================
   GET ALL EVENTS  ✅ REQUIRED
===================================================== */
router.get("/", async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error("GET EVENTS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================
   GET SINGLE EVENT (OPTIONAL BUT RECOMMENDED)
===================================================== */
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(event);
  } catch (err) {
    console.error("GET EVENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

/* =====================================================
   DELETE EVENT
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.error("DELETE EVENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
