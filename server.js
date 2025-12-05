// backend/server.js
require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json()); // To parse incoming JSON requests

// Simple Test Route
app.get('/', (req, res) => {
  res.send('EventGhar Backend is running!');
});

// Database Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connection successful!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});