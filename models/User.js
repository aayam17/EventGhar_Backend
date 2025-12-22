const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },

  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
  }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
