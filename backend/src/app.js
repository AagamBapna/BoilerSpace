const express = require('express');
const cors = require('cors');
const passport = require('passport');

const buildingRoutes = require('./routes/buildings');
const courseRoutes = require('./routes/courses');
const checkinRoutes = require('./routes/checkins');
const clubRoutes = require('./routes/clubs');
const authRoutes = require('./routes/auth');

require('./config/passport');
const userRoutes = require('./routes/users');
const bookmarkRoutes = require('./routes/bookmarks');

const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use('/api/buildings', buildingRoutes);
app.use('/api/buildings', checkinRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users', bookmarkRoutes);
app.use('/api/clubs', clubRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
