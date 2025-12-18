const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event" },
  eventTitle: String,

  user: {
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

  promoCode: String,
  discount: Number,
  subtotal: Number,
  total: Number,

  payment: {
    method: String,      // eSewa
    status: String,      // PAID / FAILED
    transactionId: String,
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Order", OrderSchema);
