const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema({
  type: String,
  price: Number,
});

const EventSchema = new mongoose.Schema(
  {
    // EXISTING (UNCHANGED)
    title: { type: String, required: true },
    formattedDate: { type: String, required: true },
    price: { type: Number, required: true },
    formattedPrice: String,
    packages: String,
    imageSrc: { type: String, required: true },

    // 🔥 NEW (FOR DETAILS PAGE)
    description: String,
    time: String,

    organizer: {
      name: String,
      logo: String,
    },

    venue: {
      name: String,
      address: String,
      mapEmbedUrl: String,
    },

    tickets: [TicketSchema],

    // FEATURED (UNCHANGED)
    isFeatured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0 },
    featuredDetails: String,
    featuredExpiry: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", EventSchema);
