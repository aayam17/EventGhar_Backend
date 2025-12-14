const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    formattedDate: { type: String, required: true },
    price: { type: Number, required: true },
    formattedPrice: String,
    packages: String,
    imageSrc: { type: String, required: true },

    /* 🔥 FEATURED EVENT FIELDS */
    isFeatured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0 },
    featuredDetails: { type: String },
    featuredExpiry: { type: Date }, // auto-hide logic
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", EventSchema);
