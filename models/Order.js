const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  eventTitle: String,

  user: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ✅ REQUIRED
    name: String,
    email: String,
    phone: String,
    address: String,
  },

  tickets: [
    {
      type: String,
      price: Number,
      qty: Number,
    },
  ],

  subtotal: Number,
  discount: Number,
  total: Number,

  payment: {
    method: String,
    status: String, // PAID / FAILED
    transactionId: String,
  },

  // 🎫 QR
  used: { type: Boolean, default: false },
  usedAt: Date,

  // 🔁 REFUND SYSTEM
  refund: {
    requested: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["NONE", "PENDING", "APPROVED", "REJECTED"],
      default: "NONE",
    },
    requestedAt: Date,
    resolvedAt: Date,
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", OrderSchema);
