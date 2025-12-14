const mongoose = require("mongoose");

const FeaturedEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: String,
    venue: String,
    eventDateTime: { type: Date, required: true },
    imageSrc: { type: String, required: true },

    /* 🔥 NEW */
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    expiryDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FeaturedEvent", FeaturedEventSchema);
