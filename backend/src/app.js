const express = require('express');
const cors = require('cors');
const buildingRoutes = require('./routes/buildings');
const courseRoutes = require('./routes/courses');
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/buildings', buildingRoutes);
app.use('/api/courses', courseRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;