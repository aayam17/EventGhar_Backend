const router = require("express").Router();
const Subscriber = require("../models/Subscriber");
const adminAuth = require("../middleware/adminAuth");
const rateLimit = require("../utils/rateLimit");

const subscribeLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

router.post("/", subscribeLimit, async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    await Subscriber.findOneAndUpdate(
      { email },
      { email },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("NEWSLETTER ERROR:", err);
    res.status(500).json({ message: "Could not subscribe" });
  }
});

router.get("/", adminAuth, async (req, res) => {
  const subscribers = await Subscriber.find().sort({ createdAt: -1 });
  res.json(subscribers);
});

// Public unsubscribe link, clicked straight from the email footer.
// Requires both email + token so nobody can unsubscribe someone else's address.
router.get("/unsubscribe", async (req, res) => {
  const email = String(req.query.email || "").trim().toLowerCase();
  const token = String(req.query.token || "");

  const page = (message) => `
    <!DOCTYPE html>
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style="font-family: -apple-system, sans-serif; background:#fff; color:#171717; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; text-align:center;">
        <div>
          <h2 style="font-size:20px; margin-bottom:8px;">${message}</h2>
          <p style="color:#737373;">EventGhar</p>
        </div>
      </body>
    </html>
  `;

  if (!email || !token) {
    return res.status(400).send(page("Invalid unsubscribe link."));
  }

  const result = await Subscriber.findOneAndDelete({ email, unsubscribeToken: token });
  if (!result) {
    return res.status(404).send(page("This link has already been used or is invalid."));
  }

  res.send(page("You've been unsubscribed from EventGhar updates."));
});

module.exports = router;
