const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  eventTitle: String,

  /* ORIGINAL BUYER */
  purchaser: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    email: String,
  },

  /* CURRENT OWNER */
  user: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    email: String,
    phone: String,
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
    status: String,
    transactionId: String,
  },

  isGifted: { type: Boolean, default: false },

  used: { type: Boolean, default: false },
  usedAt: Date,

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
