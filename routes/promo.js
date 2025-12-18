const express = require("express");
const Promo = require("../models/PromoCode");
const router = express.Router();

/* CREATE PROMO (ADMIN) */
router.post("/", async (req, res) => {
  try {
    const promo = await Promo.create(req.body);
    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* VALIDATE PROMO (CHECKOUT) */
router.post("/validate", async (req, res) => {
  const { code } = req.body;

  const promo = await Promo.findOne({ code, isActive: true });
  if (!promo) {
    return res.status(404).json({ error: "Invalid promo code" });
  }

  res.json(promo);
});

// GET all promos
router.get("/", async (req, res) => {
  const promos = await Promo.find().sort({ createdAt: -1 });
  res.json(promos);
});


module.exports = router;
