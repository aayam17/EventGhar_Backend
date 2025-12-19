require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

/* ===============================
   MIDDLEWARE
================================ */
app.use(cors());                 // allow frontend requests
app.use(express.json());         // parse JSON bodies

/* ===============================
   ROUTES
================================ */

// Events
const eventRoutes = require("./routes/events");
app.use("/api/events", eventRoutes);

// Featured Events
const featuredRoutes = require("./routes/featuredEvents");
app.use("/api/featured-events", featuredRoutes);

// Host / Organizer Requests
const hostRequestRoutes = require("./routes/hostRequests");
app.use("/api/host-requests", hostRequestRoutes);

// Promo Codes
const promoRoutes = require("./routes/promo");
app.use("/api/promos", promoRoutes);

// Orders (Checkout / Payments)
const orderRoutes = require("./routes/orders");
app.use("/api/orders", orderRoutes);

// 🔁 Legacy eSewa Redirect (optional / fallback)
const esewaRoutes = require("./routes/esewa");
app.use("/api/esewa", esewaRoutes);


/* ===============================
   TEST ROUTE
================================ */
app.get("/", (req, res) => {
  res.send("EventGhar Backend is running!");
});

/* ===============================
   DATABASE CONNECTION
================================ */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

/* ===============================
   SERVER START
================================ */
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
