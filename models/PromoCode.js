const mongoose = require("mongoose");

const PromoCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountType: { type: String, enum: ["FLAT", "PERCENT"], required: true },
  discountValue: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model("PromoCode", PromoCodeSchema);
