const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const buildingRoutes = require('./routes/buildings');
const clubRoutes = require('./routes/clubs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/buildings', buildingRoutes);
app.use('/api/clubs', clubRoutes); // User Story 71: club profile create/update/retrieve

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server (MongoDB required for /api/clubs)
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/boilerspace';

mongoose.connect(MONGO_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`BoilerSpace API running on http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

module.exports = app;
