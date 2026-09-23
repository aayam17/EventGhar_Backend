const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    phone: { type: String, required: true },

    password: { type: String, required: true },

    // Set only for accounts created/linked via "Sign in with Google". Lets us
    // look a user up by their Google account on repeat sign-ins.
    googleId: { type: String, unique: true, sparse: true, index: true },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
