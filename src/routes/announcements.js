import { Router } from 'express';
import Announcement from '../models/Announcement.js';
import Event from '../models/Event.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/events/:eventId/announcements
 * List announcements for an event (chronological). Public.
 * Mounted at /api/events/:eventId/announcements so eventId comes from parent.
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const announcements = await Announcement.find({ eventId })
      .populate('authorId', 'id name')
      .sort({ createdAt: 1 })
      .lean();
    const normalized = announcements.map((a) => ({
      ...a,
      id: a._id.toString(),
      author: a.authorId,
      authorId: a.authorId?._id?.toString() ?? a.authorId,
    }));
    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * POST /api/events/:eventId/announcements
 * Create an announcement. Requester must be the organizer of the event's club.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { content } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Announcement content is required.',
        fields: { content: 'Content is required' },
      });
    }

    const event = await Event.findById(eventId).populate('clubId');
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const club = event.clubId;
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    const organizerId = club.organizerId?._id ?? club.organizerId;
    if (String(organizerId) !== req.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to post announcements for this event.',
      });
    }

    const announcement = await Announcement.create({
      content: content.trim(),
      eventId: event._id,
      authorId: req.userId,
    });
    await announcement.populate('authorId', 'id name');
    const doc = announcement.toObject();
    const normalized = {
      ...doc,
      id: doc._id.toString(),
      author: doc.authorId,
      authorId: doc.authorId?._id?.toString() ?? doc.authorId,
    };
    return res.status(201).json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create announcement' });
  }
});

export default router;
