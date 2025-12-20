const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const sendTicketEmail = require("../utils/sendTicketEmail");

/* ===============================
   CREATE ORDER
================================ */
router.post("/", async (req, res) => {
  try {
    const order = await Order.create(req.body);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   GET ALL ORDERS
================================ */
router.get("/", async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

/* ===============================
   🔁 USER REQUEST REFUND
================================ */
router.post("/:id/refund", async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.refund.requested) {
    return res.json({ message: "Refund already requested" });
  }

  order.refund = {
    requested: true,
    status: "PENDING",
    requestedAt: new Date(),
  };

  await order.save();
  res.json({ success: true });
});

/* ===============================
   🛠 ADMIN – GET REFUNDS (MUST BE ABOVE :id)
================================ */
router.get("/refunds", async (req, res) => {
  const refunds = await Order.find({
    "refund.status": "PENDING",
  }).sort({ "refund.requestedAt": -1 });

  res.json(refunds);
});

/* ===============================
   🛠 ADMIN – APPROVE / REJECT
================================ */
router.post("/:id/refund-action", async (req, res) => {
  const { action } = req.body; // APPROVED / REJECTED

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order.refund.status = action;
  order.refund.resolvedAt = new Date();

  await order.save();
  res.json({ success: true });
});

/* ===============================
   🎫 QR VERIFY
================================ */
router.post("/verify", async (req, res) => {
  const { ticketId } = req.body;

  const order = await Order.findById(ticketId);
  if (!order) {
    return res.json({ valid: false, message: "Invalid ticket" });
  }

  if (order.used) {
    return res.json({
      valid: false,
      message: "Ticket already used",
      usedAt: order.usedAt,
    });
  }

  order.used = true;
  order.usedAt = new Date();
  await order.save();

  res.json({
    valid: true,
    message: "Ticket verified successfully",
    order,
  });
});

/* ===============================
   TRANSFER TICKET (EMAIL ONLY)
================================ */
router.post("/transfer", async (req, res) => {
  const { orderId, newEmail, newName } = req.body;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order.user.email = newEmail;
  order.user.name = newName;
  await order.save();

  await sendTicketEmail(order);
  res.json({ success: true });
});

/* ===============================
   GET SINGLE ORDER (KEEP LAST)
================================ */
router.get("/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
