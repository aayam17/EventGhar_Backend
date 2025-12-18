const express = require("express");
const router = express.Router();
const HostRequest = require("../models/HostRequest");

// CREATE (User submits form)
router.post("/", async (req, res) => {
  try {
    const request = new HostRequest(req.body);
    await request.save();
    res.status(201).json({ message: "Request submitted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ (Admin fetch)
router.get("/", async (req, res) => {
  const requests = await HostRequest.find().sort({ createdAt: -1 });
  res.json(requests);
});

// UPDATE status (Admin approve/reject)
router.patch("/:id", async (req, res) => {
  await HostRequest.findByIdAndUpdate(req.params.id, {
    status: req.body.status,
  });
  res.json({ message: "Status updated" });
});

module.exports = router;
