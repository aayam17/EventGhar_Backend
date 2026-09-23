const express = require("express");
const router = express.Router();
const HostRequest = require("../models/HostRequest");
const adminAuth = require("../middleware/adminAuth");
const rateLimit = require("../utils/rateLimit");

const submitLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 8 });

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

router.post("/", submitLimit, async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      address,
      eventName,
      eventDate,
      details,
      companyName,
      companyAddress,
    } = req.body;

    if (!eventDate) {
      return res.status(400).json({ error: "Event date is required" });
    }
    if (!String(fullName || "").trim() || !String(eventName || "").trim()) {
      return res.status(400).json({ error: "Name and event name are required" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())) {
      return res.status(400).json({ error: "Enter a valid email address" });
    }
    if (String(details || "").length > 1000) {
      return res.status(400).json({ error: "Event details are too long" });
    }
    if (isNaN(new Date(eventDate))) {
      return res.status(400).json({ error: "Event date is not valid" });
    }

    const selectedDate = startOfDay(new Date(eventDate));
    const minDate = startOfDay(new Date());
    minDate.setDate(minDate.getDate() - 1);
    const maxDate = startOfDay(new Date());
    maxDate.setMonth(maxDate.getMonth() + 6);

    if (selectedDate < minDate || selectedDate > maxDate) {
      return res.status(400).json({
        error: "Event date must be between yesterday and the next 6 months",
      });
    }

    await HostRequest.create({
      fullName,
      email,
      phone,
      address,
      eventName,
      eventDate,
      details,
      companyName,
      companyAddress,
    });

    res.status(201).json({ message: "Request submitted successfully" });
  } catch (err) {
    console.error("Host request error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", adminAuth, async (req, res) => {
  try {
    const requests = await HostRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch host requests" });
  }
});

router.patch("/:id", adminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    await HostRequest.findByIdAndUpdate(req.params.id, { status });
    res.json({ message: "Status updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;
