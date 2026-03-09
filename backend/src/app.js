const express = require('express');
const path = require('path');
const cors = require('cors');
const passport = require('passport');

const buildingRoutes = require('./routes/buildings');
const courseRoutes = require('./routes/courses');
const checkinRoutes = require('./routes/checkins');
const clubRoutes = require('./routes/clubs');
const noteRoutes = require('./routes/notes');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const announcementRoutes = require('./routes/announcements');
const announcementFeedRoutes = require('./routes/announcementFeed');

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
app.use('/api/users', bookmarkRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/courses', noteRoutes);
app.use('/api/notes', noteRoutes);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/events', announcementRoutes);
app.use('/api/announcements', announcementFeedRoutes);

app.use('/api/events', eventRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
