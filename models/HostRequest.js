const mongoose = require("mongoose");

const HostRequestSchema = new mongoose.Schema(
  {
    fullName: String,
    email: String,
    phone: String,
    address: String,

    eventName: String,
    eventDate: String,
    details: String,

    companyName: String,
    companyAddress: String,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HostRequest", HostRequestSchema);
