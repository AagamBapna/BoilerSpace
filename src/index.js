import express from 'express';
import { connectDB } from './lib/db.js';
import clubsRouter from './routes/clubs.js';
import eventsRouter from './routes/events.js';
import announcementsRouter from './routes/announcements.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/api/clubs', clubsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/events/:eventId/announcements', announcementsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`BoilerSpace API listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
