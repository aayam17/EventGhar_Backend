// backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// FIX: Relaxing CORS for local development to resolve HTTP ERROR 403
// The previous line was: app.use(cors({ origin: "http://localhost:5173" })); 
app.use(cors()); 

app.use(express.json());

// Routes
const eventRoutes = require("./routes/events");
app.use("/api/events", eventRoutes);

const featuredRoutes = require("./routes/featuredEvents");
app.use("/api/featured-events", featuredRoutes);


// Test route
app.get("/", (req, res) => {
  res.send("EventGhar Backend is running!");
});

// DB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});