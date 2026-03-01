import { Router } from 'express';
import Event from '../models/Event.js';
import Club from '../models/Club.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/events
 * List events (chronological). Optional query: clubId, fromDate, toDate. Public.
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { clubId, fromDate, toDate } = req.query;
    const filter = {};
    if (clubId) filter.clubId = clubId;
    if (fromDate) filter.date = { ...filter.date, $gte: fromDate };
    if (toDate) filter.date = { ...filter.date, $lte: toDate };

    const events = await Event.find(filter)
      .populate({
        path: 'clubId',
        select: 'id name category',
        populate: { path: 'organizerId', select: 'id name' },
      })
      .sort({ date: 1, time: 1 })
      .lean();
    const normalized = events.map((e) => ({
      ...e,
      id: e._id.toString(),
      club: e.clubId,
      clubId: e.clubId?._id?.toString(),
    }));
    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/events/:id
 * Get a single event. Public.
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate({
        path: 'clubId',
        select: 'id name category contactInfo',
        populate: { path: 'organizerId', select: 'id name email' },
      })
      .lean();
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const normalized = {
      ...event,
      id: event._id.toString(),
      club: event.clubId,
      clubId: event.clubId?._id?.toString(),
    };
    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * POST /api/events
 * Create an event. Requester must be the organizer of the club.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, date, time, location, clubId } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Event title is required.',
        fields: { title: 'Title is required' },
      });
    }
    if (!date || typeof date !== 'string' || !date.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Event date is required.',
        fields: { date: 'Date is required' },
      });
    }
    if (!location || typeof location !== 'string' || !location.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Event location is required.',
        fields: { location: 'Location is required' },
      });
    }
    if (!clubId || typeof clubId !== 'string' || !clubId.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Club is required.',
        fields: { clubId: 'Club is required' },
      });
    }

    const club = await Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    if (String(club.organizerId) !== req.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to create events for this club.',
      });
    }

    const event = await Event.create({
      title: title.trim(),
      description: description?.trim() ?? undefined,
      date: date.trim(),
      time: time?.trim() ?? undefined,
      location: location.trim(),
      clubId: club._id,
    });
    await event.populate({
      path: 'clubId',
      select: 'id name category',
      populate: { path: 'organizerId', select: 'id name' },
    });
    const doc = event.toObject();
    const normalized = {
      ...doc,
      id: doc._id.toString(),
      club: doc.clubId,
      clubId: doc.clubId?._id?.toString(),
    };
    return res.status(201).json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

export default router;
