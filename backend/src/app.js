const express = require('express');
const cors = require('cors');
const buildingRoutes = require('./routes/buildings');
const passport = require('passport');
const authRoutes = require('./routes/auth');
const noteRoutes = require('./routes/notes');


require('./config/passport');
const courseRoutes = require('./routes/courses');
const userRoutes = require('./routes/users');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/buildings', buildingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notes', noteRoutes);


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
