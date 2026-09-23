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

    eventDateTime: Date,

    // LIVE SONG — admin pastes a YouTube link for this specific event;
    // the video ID is parsed out and stored so the frontend can drive
    // a hidden YouTube IFrame player (audio only, video element hidden)
    // from the animated waveform bar instead of embedding a visible
    // video player anywhere.
    songUrl: { type: String, default: "" },
    songTitle: { type: String, default: "" },

    // FEATURED (UNCHANGED)
    isFeatured: { type: Boolean, default: false },
    featuredOrder: { type: Number, default: 0 },
    featuredDetails: String,
    featuredExpiry: Date,

    // REFUND CONTROL — events are non-refundable by default.
    // Admin flips this per event only when that specific event
    // is cancelled/postponed, so refund requests stay scoped to
    // the tickets that are actually affected.
    isRefundable: { type: Boolean, default: false },
    refundReason: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", EventSchema);
