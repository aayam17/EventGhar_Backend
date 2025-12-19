const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const sendTicketEmail = require("../utils/sendTicketEmail");

/* ===============================
   CREATE ORDER (NO EMAIL)
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
   GET SINGLE ORDER
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

/* ===============================
   🎫 QR VERIFY (ADMIN)
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
   🔁 TRANSFER TICKET (EMAIL ONLY HERE)
================================ */
router.post("/transfer", async (req, res) => {
  const { orderId, newEmail, newName } = req.body;

  const order = await Order.findById(orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order.user.email = newEmail;
  order.user.name = newName;
  await order.save();

  // ✅ EMAIL ONLY WHEN TRANSFERRING
  await sendTicketEmail(order);

  res.json({ success: true });
});

module.exports = router;
