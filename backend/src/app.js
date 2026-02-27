const express = require('express');
const cors = require('cors');
const buildingRoutes = require('./routes/buildings');
const clubRoutes = require('./routes/clubs');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/buildings', buildingRoutes);
app.use('/api/clubs', clubRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
