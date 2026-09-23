const mongoose = require("mongoose");

const OrderTicketSchema = new mongoose.Schema(
  {
    type: { type: String },
    price: Number,
    qty: Number,
  },
  { _id: false }
);

const PassSchema = new mongoose.Schema(
  {
    token: { type: String },
    type: { type: String },
    used: { type: Boolean, default: false },
    usedAt: Date,
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  eventTitle: String,

  purchaser: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    email: String,
  },

  user: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    email: String,
    phone: String,
  },

  tickets: [OrderTicketSchema],

  subtotal: Number,
  discount: { type: Number, default: 0 },
  promoCode: { type: String, default: "" },
  total: Number,

  payment: {
    method: String,
    status: String,
    transactionId: String,
  },

  ticketToken: { type: String, unique: true, sparse: true, index: true },

  // One entry per individual ticket (a 3-ticket order has 3 passes), each with
  // its own QR token so a group can arrive separately. Orders made before this
  // change have no passes and keep using ticketToken for a single scan.
  passes: [PassSchema],

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

OrderSchema.index({ "passes.token": 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Order", OrderSchema);
