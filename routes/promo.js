const express = require("express");
const Promo = require("../models/PromoCode");
const router = express.Router();
const adminAuth = require("../middleware/adminAuth");
const rateLimit = require("../utils/rateLimit");
const { findActivePromo } = require("../utils/pricing");

// Stops someone from guessing promo codes by hammering the validate endpoint
const validateLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 40 });

router.post("/", adminAuth, async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const discountType = req.body.discountType;
    const discountValue = Number(req.body.discountValue);

    if (!code) return res.status(400).json({ error: "Promo code is required" });
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      return res.status(400).json({
        error: "Use 3 to 30 letters, numbers, dashes or underscores",
      });
    }
    if (!["FLAT", "PERCENT"].includes(discountType)) {
      return res.status(400).json({ error: "Choose flat or percentage" });
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return res.status(400).json({ error: "Discount must be more than 0" });
    }
    if (discountType === "PERCENT" && discountValue > 100) {
      return res.status(400).json({ error: "A percentage can't be over 100" });
    }

    const promo = await Promo.create({
      code,
      discountType,
      discountValue,
      isActive: req.body.isActive !== false,
    });
    res.json(promo);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "That promo code already exists" });
    }
    res.status(400).json({ error: err.message });
  }
});

router.post("/validate", validateLimit, async (req, res) => {
  const promo = await findActivePromo(req.body.code);
  if (!promo) {
    return res.status(404).json({ error: "Invalid promo code" });
  }
  res.json({
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
  });
});

router.get("/", adminAuth, async (req, res) => {
  const promos = await Promo.find().sort({ createdAt: -1 });
  res.json(promos);
});

/* Turn a code on or off without deleting it */
router.patch("/:id/toggle", adminAuth, async (req, res) => {
  try {
    const promo = await Promo.findById(req.params.id);
    if (!promo) return res.status(404).json({ error: "Promo code not found" });
    promo.isActive = !promo.isActive;
    await promo.save();
    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: "Invalid promo id" });
  }
});

/* Delete a code permanently */
router.delete("/:id", adminAuth, async (req, res) => {
  try {
    const deleted = await Promo.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Promo code not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Invalid promo id" });
  }
});

module.exports = router;
