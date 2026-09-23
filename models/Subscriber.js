const mongoose = require("mongoose");
const crypto = require("crypto");

const SubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Random per-subscriber secret used to build unsubscribe links,
    // so nobody can unsubscribe someone else just by knowing their email.
    unsubscribeToken: {
      type: String,
      default: () => crypto.randomBytes(24).toString("hex"),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Subscriber", SubscriberSchema);
