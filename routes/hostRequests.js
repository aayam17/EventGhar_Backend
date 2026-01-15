const express = require("express");
const router = express.Router();
const HostRequest = require("../models/HostRequest");

/* DATE VALIDATION HELPERS */
const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/* CREATE (USER SUBMITS FORM)  */
router.post("/", async (req, res) => {
  try {
    const { eventDate } = req.body;

    /* REQUIRED DATE CHECK */
    if (!eventDate) {
      return res.status(400).json({
        error: "Event date is required",
      });
    }

    /* DATE RANGE VALIDATION */
    const selectedDate = startOfDay(new Date(eventDate));

    // Yesterday (allowed)
    const minDate = startOfDay(new Date());
    minDate.setDate(minDate.getDate() - 1);

    // Today + 6 months (max)
    const maxDate = startOfDay(new Date());
    maxDate.setMonth(maxDate.getMonth() + 6);

    if (selectedDate < minDate || selectedDate > maxDate) {
      return res.status(400).json({
        error:
          "Event date must be between yesterday and the next 6 months",
      });
    }

    /* SAVE REQUEST */
    const request = new HostRequest(req.body);
    await request.save();

    res.status(201).json({
      message: "Request submitted successfully",
    });
  } catch (err) {
    console.error("Host request error:", err);
    res.status(500).json({
      error: "Internal server error",
    });
  }
});

/* READ (ADMIN FETCH) */
router.get("/", async (req, res) => {
  try {
    const requests = await HostRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({
      error: "Failed to fetch host requests",
    });
  }
});

/* UPDATE STATUS (ADMIN APPROVE/REJECT)*/
router.patch("/:id", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        error: "Invalid status value",
      });
    }

    await HostRequest.findByIdAndUpdate(req.params.id, { status });

    res.json({
      message: "Status updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to update status",
    });
  }
});

module.exports = router;
