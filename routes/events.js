const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const router = express.Router();
const Event = require("../models/Event");
const FeaturedEvent = require("../models/FeaturedEvent");
const upload = require("../middleware/upload");
const User = require("../models/User");
const Notification = require("../models/Notification");
const adminAuth = require("../middleware/adminAuth");
const parseTickets = require("../utils/parseTickets");
const sendNewsletterEmail = require("../utils/sendNewsletterEmail");

function isAdminRequest(req) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return false;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.role === "admin";
  } catch {
    return false;
  }
}

async function notifyUsers(event) {
  const users = await User.find({ role: "user" }).select("_id");
  if (!users.length) return;
  await Notification.insertMany(
    users.map((u) => ({
      userId: u._id,
      type: "NEW_EVENT",
      title: "📢 New Event Published",
      message: event.title,
      link: `/events/${event._id}`,
    }))
  );
}

router.post("/", adminAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image is required" });
    }

    const tickets = parseTickets(req.body.tickets);
    if (tickets === null) {
      return res.status(400).json({ error: "Invalid tickets data" });
    }

    const event = new Event({
      title: req.body.title,
      formattedDate: req.body.formattedDate,
      price: Number(req.body.price),
      formattedPrice: req.body.formattedPrice,
      packages: req.body.packages,
      imageSrc: req.file.path,
      description: req.body.description || "",
      time: req.body.time || "",
      organizer: req.body.organizer ? JSON.parse(req.body.organizer) : {},
      venue: req.body.venue ? JSON.parse(req.body.venue) : {},
      tickets,
      eventDateTime: req.body.eventDateTime || undefined,
      songUrl: req.body.songUrl || "",
      songTitle: req.body.songTitle || "",
    });

    await event.save();
    await notifyUsers(event);
    sendNewsletterEmail(event); // fire-and-forget: don't make the admin wait on email delivery
    res.status(201).json(event);
  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const showAll = req.query.all === "true" && isAdminRequest(req);
    const query = showAll ? {} : { isRefundable: { $ne: true } };
    const events = await Event.find(query).sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error("GET EVENTS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const validId = mongoose.Types.ObjectId.isValid(req.params.id);
    let event = validId ? await Event.findById(req.params.id) : null;

    if (!event && validId) {
      const featured = await FeaturedEvent.findById(req.params.id);
      if (featured?.eventId) {
        event = await Event.findById(featured.eventId);
      }
    }

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json(event);
  } catch (err) {
    console.error("GET EVENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const existing = await Event.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Event not found" });
    }

    let organizer = existing.organizer;
    let venue = existing.venue;
    let tickets = existing.tickets;

    try {
      if (req.body.organizer) organizer = JSON.parse(req.body.organizer);
      if (req.body.venue) venue = JSON.parse(req.body.venue);
      if (req.body.tickets) {
        const parsed = parseTickets(req.body.tickets);
        if (parsed === null) {
          return res.status(400).json({
            error: "Invalid organizer/venue/tickets data sent from the form.",
          });
        }
        tickets = parsed;
      }
    } catch {
      return res.status(400).json({
        error: "Invalid organizer/venue/tickets data sent from the form.",
      });
    }

    const price = Number(req.body.price);
    if (req.body.price !== undefined && Number.isNaN(price)) {
      return res.status(400).json({ error: "Price must be a number." });
    }

    const update = {
      title: req.body.title,
      formattedDate: req.body.formattedDate,
      price: Number.isNaN(price) ? existing.price : price,
      formattedPrice: req.body.formattedPrice,
      packages: req.body.packages,
      description: req.body.description || "",
      time: req.body.time || "",
      organizer,
      venue,
      tickets,
      eventDateTime: req.body.eventDateTime || existing.eventDateTime,
      songUrl: req.body.songUrl !== undefined ? req.body.songUrl : existing.songUrl,
      songTitle:
        req.body.songTitle !== undefined ? req.body.songTitle : existing.songTitle,
    };

    if (req.file) update.imageSrc = req.file.path;

    const event = await Event.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });

    res.json(event);
  } catch (err) {
    console.error("UPDATE EVENT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", adminAuth, async (req, res) => {
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

router.patch("/:id/refund-eligibility", adminAuth, async (req, res) => {
  try {
    const { isRefundable, refundReason } = req.body;
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      {
        isRefundable: !!isRefundable,
        refundReason: isRefundable ? refundReason || "" : "",
      },
      { new: true }
    );

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(event);
  } catch (err) {
    console.error("REFUND ELIGIBILITY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
