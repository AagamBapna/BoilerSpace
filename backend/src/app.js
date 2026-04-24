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
const aiRoutes = require('./routes/ai');
const notificationRoutes = require('./routes/notifications');
const friendshipRoutes = require('./routes/friendships');
const roomRoutes = require('./routes/rooms');
const analyticsRoutes = require('./routes/analytics');

require('./config/passport');
const userRoutes = require('./routes/users');
const bookmarkRoutes = require('./routes/bookmarks');
const aiBookmarkRoutes = require('./routes/aiBookmarks');
const messageRoutes = require('./routes/messages');
const reviewRoutes = require('./routes/reviews');
const messageReactionRoutes = require('./routes/messageReactions');

const app = express();

app.use(cors());
app.use(express.json());
app.use(passport.initialize());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/buildings', buildingRoutes);
app.use('/api/buildings', checkinRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/users', aiBookmarkRoutes);
app.use('/api/users', bookmarkRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/courses', noteRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/events', announcementRoutes);
app.use('/api/announcements', announcementFeedRoutes);
app.use('/api/courses', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use('/api/friendships', friendshipRoutes);
app.use('/api/messages', messageReactionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/reviews', reviewRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;
