const router = require("express").Router();
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const publicUser = require("../utils/publicUser");
const rateLimit = require("../utils/rateLimit");

const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.post("/register", authLimit, async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (String(password).length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName: String(fullName).trim(),
      email: normalizedEmail,
      phone: String(phone).trim(),
      password: hash,
      role: "user",
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/login", authLimit, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/* GOOGLE SIGN-IN — verifies the ID token Google's Identity Services widget
   hands the frontend, then finds/creates/links the matching account. */
router.post("/google", authLimit, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Missing Google credential" });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error("GOOGLE_CLIENT_ID is missing from .env");
      return res.status(500).json({ message: "Google sign-in isn't configured yet" });
    }

    // Ask Google itself to verify the token's signature/expiry so we never
    // have to handle JWKS/crypto verification ourselves.
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    if (!verifyRes.ok) {
      return res.status(401).json({ message: "Invalid Google credential" });
    }
    const payload = await verifyRes.json();

    // The token must have been issued specifically for OUR client ID, and by
    // Google, or anyone else's valid Google token would also pass here.
    if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ message: "Invalid Google credential" });
    }
    if (!/^(https:\/\/)?accounts\.google\.com$/.test(payload.iss || "")) {
      return res.status(401).json({ message: "Invalid Google credential" });
    }
    if (payload.email_verified !== "true" && payload.email_verified !== true) {
      return res.status(403).json({ message: "Your Google email isn't verified" });
    }

    const email = String(payload.email || "").trim().toLowerCase();
    const googleId = payload.sub;
    if (!email || !googleId) {
      return res.status(401).json({ message: "Invalid Google credential" });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // Brand new account. It signs in via Google only, so the password is a
      // random value nobody knows and can never be used to log in directly.
      const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
      user = await User.create({
        fullName: payload.name || email.split("@")[0],
        email,
        phone: "",
        password: randomHash,
        googleId,
        role: "user",
      });
    } else if (!user.googleId) {
      // An existing password account with this same, Google-verified email —
      // link it so either sign-in method works from now on.
      user.googleId = googleId;
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("GOOGLE AUTH ERROR:", err);
    res.status(500).json({ message: "Google sign-in failed" });
  }
});

module.exports = router;
