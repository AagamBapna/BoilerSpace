const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Announcement = require('../models/Announcement');
const Club = require('../models/Club');
const { protect } = require('../middleware/auth');

/**
 * GET /api/events/:eventId/announcements
 * Returns announcements for an event (chronological)
 */
router.get('/:eventId/announcements', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const anns = await Announcement.find({ eventId })
      .populate({ path: 'authorId', select: 'id displayName' })
      .sort({ createdAt: 1 })
      .lean();

    const normalized = anns.map((a) => ({
      ...a,
      id: a._id.toString(),
      author: a.authorId,
      authorId: a.authorId?._id?.toString(),
    }));

    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * POST /api/events/:eventId/announcements
 * Only the club organizer for the event's club may post announcements
 */
router.post('/:eventId/announcements', protect, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim())
      return res.status(400).json({ error: 'Validation failed', fields: { message: 'Message is required' } });

    const event = await Event.findById(eventId).populate('clubId');
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // club.organizerIds is an array of organizer ids
    if (!Array.isArray(event.clubId.organizerIds) || !event.clubId.organizerIds.map(String).includes(String(req.user.id)))
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to post announcements for this event.' });

    const ann = await Announcement.create({
      eventId: event._id,
      clubId: event.clubId?._id,
      authorId: req.user._id || req.user.id,
      message: message.trim(),
    });

    await ann.populate({ path: 'authorId', select: 'id displayName' });

    const doc = ann.toObject();
    const normalized = {
      ...doc,
      id: doc._id.toString(),
      author: doc.authorId,
      authorId: doc.authorId?._id?.toString(),
    };

    return res.status(201).json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/**
 * POST /api/clubs/:clubId/announcements
 * Only a club organizer may post a club-wide announcement with no event.
 */
router.post('/clubs/:clubId/announcements', protect, async (req, res) => {
  try {
    const { clubId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: { message: 'Message is required' },
      });
    }

    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: 'Club not found' });

    const organizerIds = Array.isArray(club.organizerIds) ? club.organizerIds.map(String) : [];
    if (!organizerIds.includes(String(req.user.id))) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to post announcements for this club.',
      });
    }

    const ann = await Announcement.create({
      eventId: null,
      clubId: club._id,
      authorId: req.user._id || req.user.id,
      message: message.trim(),
    });

    await ann.populate({ path: 'authorId', select: 'id displayName' });
    await ann.populate({ path: 'clubId', select: 'name category' });

    const doc = ann.toObject();
    return res.status(201).json({
      ...doc,
      id: doc._id.toString(),
      author: doc.authorId,
      authorId: doc.authorId?._id?.toString(),
      eventId: null,
      event: null,
      club: doc.clubId,
      clubId: doc.clubId?._id?.toString(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create announcement' });
  }
});

module.exports = router;