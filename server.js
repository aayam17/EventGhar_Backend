require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is missing from .env");
  process.exit(1);
}

if (!process.env.ESEWA_SECRET_KEY) {
  console.warn(
    "ESEWA_SECRET_KEY is missing from .env. eSewa payments will fail until it is set."
  );
}

const app = express();

// Behind a host like Render, Railway or Nginx every request arrives from the
// proxy's IP, so the login rate limiter would count all visitors together.
// Set TRUST_PROXY=1 in production so req.ip is the real visitor address.
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);
}

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/adminAuth"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/events", require("./routes/events"));
app.use("/api/featured-events", require("./routes/featuredEvents"));
app.use("/api/host-requests", require("./routes/hostRequests"));
app.use("/api/promos", require("./routes/promo"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/esewa", require("./routes/esewa"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/newsletter", require("./routes/newsletter"));

app.get("/", (req, res) => {
  res.send("EventGhar Backend is running!");
});

// Unknown API paths return JSON instead of an HTML error page
app.use("/api", (req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Last-resort error handler (also catches the CORS rejection above)
app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Origin not allowed" });
  }
  console.error("UNHANDLED ERROR:", err);
  res.status(500).json({ message: "Something went wrong" });
});

const PORT = process.env.PORT || 5001;

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is missing from .env");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  })
  .then(() => {
    console.log("MongoDB Connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    console.error(
      "Check: Atlas → Network Access (whitelist your current IP), cluster not paused, VPN off, try another network/DNS."
    );
    process.exit(1);
  });
