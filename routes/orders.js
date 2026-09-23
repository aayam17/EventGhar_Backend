const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Order = require("../models/Order");
const Event = require("../models/Event");
const User = require("../models/User");
const sendTicketEmail = require("../utils/sendTicketEmail");
const sendPurchaseEmail = require("../utils/sendPurchaseEmail");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const { priceOrder } = require("../utils/pricing");

function newTicketToken() {
  return crypto.randomBytes(24).toString("hex");
}

// One pass per individual ticket, each with its own random QR token.
function buildPasses(tickets) {
  const passes = [];
  for (const line of tickets) {
    for (let i = 0; i < line.qty; i++) {
      passes.push({ token: newTicketToken(), type: line.type, used: false });
    }
  }
  return passes;
}

function isCurrentOwner(order, userId) {
  return String(order.user?.id || "") === String(userId);
}

function canManageOrder(order, userId) {
  const uid = String(userId);
  return (
    String(order.user?.id || "") === uid ||
    String(order.purchaser?.id || "") === uid
  );
}

async function findByTicket(ticketId) {
  if (!ticketId) return null;
  let order = await Order.findOne({ ticketToken: ticketId });
  if (!order && mongoose.Types.ObjectId.isValid(ticketId)) {
    order = await Order.findById(ticketId);
  }
  return order;
}

/* CREATE ORDER — price and payment status are rebuilt on the server */
router.post("/", auth, async (req, res) => {
  try {
    const account = await User.findById(req.userId);
    if (!account) return res.status(401).json({ message: "Unauthorized" });

    const event = await Event.findById(req.body.eventId);
    if (!event) return res.status(404).json({ message: "Event not found" });
    if (event.isRefundable) {
      return res.status(400).json({ message: "This event is not on sale" });
    }
    if (event.eventDateTime && new Date(event.eventDateTime) < new Date()) {
      return res.status(400).json({ message: "This event has ended" });
    }

    const priced = await priceOrder({
      event,
      requestedTickets: req.body.tickets,
      promoCode: req.body.promoCode,
    });
    if (priced.error) return res.status(400).json({ message: priced.error });

    const isFree = priced.total === 0;
    const name = String(req.body.user?.name || account.fullName).trim();
    const email = String(req.body.user?.email || account.email).trim();
    const phone = String(req.body.user?.phone || account.phone || "").trim();

    const order = await Order.create({
      eventId: event._id,
      eventTitle: event.title,
      purchaser: {
        id: account._id,
        name: account.fullName,
        email: account.email,
      },
      user: { id: account._id, name, email, phone },
      tickets: priced.tickets,
      subtotal: priced.subtotal,
      discount: priced.discount,
      promoCode: priced.promoCode,
      total: priced.total,
      payment: {
        method: isFree ? "FREE" : "ESEWA",
        status: isFree ? "PAID" : "PENDING",
      },
      ticketToken: newTicketToken(),
      passes: buildPasses(priced.tickets),
    });

    if (isFree) {
      await Notification.create({
        userId: account._id,
        type: "TICKET_PURCHASE",
        title: "🎟 Ticket Confirmed",
        message: `Your ticket for ${order.eventTitle} has been confirmed.`,
        link: `/ticket/${order._id}`,
      });
      try {
        await sendPurchaseEmail(order);
      } catch (emailErr) {
        console.error("Free ticket email failed:", emailErr);
      }
    }

    res.json(order);
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ message: "Could not create order" });
  }
});

/* GET ALL ORDERS (ADMIN) */
router.get("/", adminAuth, async (req, res) => {
  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

/* ADMIN – GET REFUNDS */
router.get("/refunds", adminAuth, async (req, res) => {
  const { eventId, status } = req.query;
  const query = { "refund.status": status || "PENDING" };
  if (eventId) query.eventId = eventId;
  const refunds = await Order.find(query).sort({ "refund.requestedAt": -1 });
  res.json(refunds);
});

/* ADMIN – REFUND COUNTS PER EVENT */
router.get("/refunds/summary", adminAuth, async (req, res) => {
  const summary = await Order.aggregate([
    { $match: { "refund.status": "PENDING" } },
    { $group: { _id: "$eventId", count: { $sum: 1 } } },
  ]);

  const counts = {};
  summary.forEach((row) => {
    if (row._id) counts[row._id.toString()] = row.count;
  });
  res.json(counts);
});

/* USER REQUEST REFUND */
router.post("/:id/refund", auth, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (!canManageOrder(order, req.userId)) {
    return res.status(403).json({ message: "Not your ticket" });
  }
  if (order.payment?.status !== "PAID") {
    return res.status(400).json({ message: "This order is not paid" });
  }
  if (order.refund.requested) {
    return res.json({ message: "Refund already requested" });
  }

  const event = order.eventId ? await Event.findById(order.eventId) : null;
  if (!event || !event.isRefundable) {
    return res.status(403).json({
      message: "This event isn't eligible for refunds.",
    });
  }

  order.refund = {
    requested: true,
    status: "PENDING",
    requestedAt: new Date(),
  };
  await order.save();
  res.json({ success: true });
});

/* ADMIN – APPROVE / REJECT */
router.post("/:id/refund-action", adminAuth, async (req, res) => {
  const { action } = req.body;
  if (!["APPROVED", "REJECTED"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.refund?.status !== "PENDING") {
    return res.status(400).json({
      message: "This refund request has already been handled",
    });
  }

  order.refund.status = action;
  order.refund.resolvedAt = new Date();
  await order.save();

  // Tell the customer the outcome so they don't have to keep checking
  const notifyId = order.purchaser?.id || order.user?.id;
  if (notifyId) {
    try {
      await Notification.create({
        userId: notifyId,
        type: "REFUND_UPDATE",
        title:
          action === "APPROVED"
            ? "✅ Refund approved"
            : "Refund request declined",
        message:
          action === "APPROVED"
            ? `Your refund for ${order.eventTitle} was approved.`
            : `Your refund request for ${order.eventTitle} was declined.`,
        link: "/my-bookings",
      });
    } catch (err) {
      console.error("Refund notification failed:", err);
    }
  }

  res.json({ success: true });
});

/* QR VERIFY (ADMIN SCANNER)
   New orders: each QR is one pass, so scanning admits exactly one person.
   Older orders (no passes): the single order QR admits the whole order once. */
router.post("/verify", adminAuth, async (req, res) => {
  const { ticketId, eventId } = req.body;
  if (!ticketId) return res.json({ valid: false, message: "Invalid ticket" });

  const token = String(ticketId).trim();
  const passOrder = await Order.findOne({ "passes.token": token });

  /* ---------- per-ticket pass ---------- */
  if (passOrder) {
    const pass = passOrder.passes.find((p) => p.token === token);
    const total = passOrder.passes.length;
    const position = passOrder.passes.indexOf(pass) + 1;

    if (passOrder.payment?.status !== "PAID") {
      return res.json({ valid: false, message: "Unpaid ticket" });
    }
    if (passOrder.refund?.status === "APPROVED") {
      return res.json({ valid: false, message: "Ticket was refunded" });
    }
    if (eventId && String(passOrder.eventId) !== String(eventId)) {
      return res.json({ valid: false, message: "Wrong event for this ticket" });
    }
    if (pass.used) {
      return res.json({
        valid: false,
        message: `Ticket ${position} of ${total} already used`,
        usedAt: pass.usedAt,
      });
    }

    // Atomic: only flips if this pass is still unused, so two phones scanning
    // the same QR at once can't both be admitted.
    const now = new Date();
    const result = await Order.updateOne(
      { _id: passOrder._id, passes: { $elemMatch: { token, used: false } } },
      { $set: { "passes.$.used": true, "passes.$.usedAt": now } }
    );
    if (result.modifiedCount !== 1) {
      return res.json({ valid: false, message: `Ticket ${position} of ${total} already used` });
    }

    const fresh = await Order.findById(passOrder._id);
    const remaining = fresh.passes.filter((p) => !p.used).length;
    if (remaining === 0 && !fresh.used) {
      fresh.used = true;
      fresh.usedAt = now;
      await fresh.save();
    }

    return res.json({
      valid: true,
      message: `Ticket ${position} of ${total} verified`,
      attendee: passOrder.user?.name,
      eventTitle: passOrder.eventTitle,
      ticketType: pass.type,
      position,
      total,
      remaining,
    });
  }

  /* ---------- older single-QR orders ---------- */
  const order = await findByTicket(token);

  if (!order) {
    return res.json({ valid: false, message: "Invalid ticket" });
  }
  if (order.passes?.length) {
    // The order-level code isn't valid for entry once individual passes exist.
    return res.json({
      valid: false,
      message: "Scan the individual ticket QR codes for this order",
    });
  }
  if (order.payment?.status !== "PAID") {
    return res.json({ valid: false, message: "Unpaid ticket" });
  }
  if (order.refund?.status === "APPROVED") {
    return res.json({ valid: false, message: "Ticket was refunded" });
  }
  if (eventId && String(order.eventId) !== String(eventId)) {
    return res.json({ valid: false, message: "Wrong event for this ticket" });
  }
  if (order.used) {
    return res.json({
      valid: false,
      message: "Ticket already used",
      usedAt: order.usedAt,
    });
  }

  const claimed = await Order.updateOne(
    { _id: order._id, used: false },
    { $set: { used: true, usedAt: new Date() } }
  );
  if (claimed.modifiedCount !== 1) {
    return res.json({ valid: false, message: "Ticket already used" });
  }

  res.json({
    valid: true,
    message: "Ticket verified successfully",
    attendee: order.user?.name,
    eventTitle: order.eventTitle,
    tickets: order.tickets,
  });
});

/* TRANSFER TICKET */
router.post("/transfer", auth, async (req, res) => {
  try {
    const { orderId, newEmail, newName } = req.body;
    if (!orderId || !newEmail || !newName) {
      return res.status(400).json({ message: "All fields required" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!isCurrentOwner(order, req.userId)) {
      return res.status(403).json({ message: "Not your ticket" });
    }
    if (order.payment?.status !== "PAID") {
      return res.status(400).json({ message: "This ticket is not paid" });
    }
    if (order.refund?.status === "APPROVED") {
      return res.status(400).json({ message: "Refunded tickets cannot be transferred" });
    }
    if (order.used) {
      return res.status(400).json({ message: "Used tickets cannot be transferred" });
    }

    const recipient = await User.findOne({
      email: String(newEmail).trim().toLowerCase(),
    });
    if (!recipient) {
      return res.status(400).json({
        message: "Recipient must be a registered user",
      });
    }
    if (String(recipient._id) === String(order.user.id)) {
      return res.status(400).json({ message: "That person already owns this ticket" });
    }

    if (!order.purchaser?.id) {
      order.purchaser = {
        id: order.user.id,
        name: order.user.name,
        email: order.user.email,
      };
    }

    order.user = {
      id: recipient._id,
      name: recipient.fullName || newName,
      email: recipient.email,
      phone: recipient.phone,
    };
    order.isGifted = true;

    // Re-issue unused QR codes so the previous owner's copy (a screenshot,
    // a forwarded email) no longer works. Already-used passes stay as history.
    order.ticketToken = newTicketToken();
    if (order.passes?.length) {
      order.passes = order.passes.map((p) =>
        p.used
          ? p.toObject()
          : { token: newTicketToken(), type: p.type, used: false }
      );
    }
    await order.save();

    await Notification.create({
      userId: recipient._id,
      type: "TICKET_GIFT",
      title: "🎁 Ticket Received",
      message: `You received a ticket for ${order.eventTitle}`,
      link: `/ticket/${order._id}`,
    });

    await sendTicketEmail(order);
    res.json({ success: true });
  } catch (err) {
    console.error("TRANSFER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* GET MY BOOKINGS */
router.get("/mine", auth, async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { "purchaser.id": req.userId },
        { "user.id": req.userId },
      ],
    })
      .populate("eventId", "title isRefundable refundReason")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET SINGLE ORDER */
router.get("/:id", auth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!canManageOrder(order, req.userId)) {
      return res.status(403).json({ error: "Not your ticket" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE ORDER (ADMIN) */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    await Order.findByIdAndDelete(req.params.id);
    await Notification.deleteMany({ link: `/ticket/${req.params.id}` });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ORDER ERROR:", err);
    res.status(500).json({ message: "Failed to delete order" });
  }
});

module.exports = router;
