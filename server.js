require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= ROUTES ================= */

// Auth
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/adminAuth"));
app.use("/api/profile", require("./routes/profile"));

// Existing
app.use("/api/events", require("./routes/events"));
app.use("/api/featured-events", require("./routes/featuredEvents"));
app.use("/api/host-requests", require("./routes/hostRequests"));
app.use("/api/promos", require("./routes/promo"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/esewa", require("./routes/esewa"));

/* ================= TEST ================= */
app.get("/", (req, res) => {
  res.send("EventGhar Backend is running!");
});

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

/* ================= SERVER ================= */
const PORT = process.env.PORT || 5001;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
