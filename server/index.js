const express = require('express');
const cors = require('cors');
require('dotenv').config();

const buildingRoutes = require('./routes/buildings');
const courseRoutes = require('./routes/courses');
const userRoutes = require('./routes/users');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/buildings', buildingRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`BoilerSpace API running on http://localhost:${PORT}`);
});

module.exports = app;
