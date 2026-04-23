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
    const { body, title } = req.body;

    if (!body || !body.trim())
      return res.status(400).json({ error: 'Validation failed', fields: { body: 'Body is required' } });

    const event = await Event.findById(eventId).populate('clubId');
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // club.organizerIds is an array of organizer ids
    if (!Array.isArray(event.clubId.organizerIds) || !event.clubId.organizerIds.map(String).includes(String(req.user.id)))
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to post announcements for this event.' });

    const ann = await Announcement.create({
      eventId: event._id,
      clubId: event.clubId?._id,
      authorId: req.user._id || req.user.id,
      body: body.trim(),
      title: title ? title.trim() : undefined,
      type: 'event',
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
    const { body, title } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: { body: 'Body is required' },
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
      body: body.trim(),
      title: title ? title.trim() : undefined,
      type: 'club',
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

/**
 * POST /api/announcements/broadcast
 * Create a global announcement. Requires Admin.
 */
router.post('/broadcast', protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const { title, body, priorityLevel, expirationDate } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Body is required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });

    // Validate priority
    const priority = ['info', 'warning', 'alert'].includes(priorityLevel) ? priorityLevel : 'info';
    
    // Set expiration 
    let expires = null;
    if (expirationDate) {
       expires = new Date(expirationDate);
       if (isNaN(expires.getTime())) return res.status(400).json({ error: 'Invalid expiration date' });
    } else {
       // default to 7 days if not provided
       expires = new Date();
       expires.setDate(expires.getDate() + 7);
    }

    const ann = await Announcement.create({
      authorId: req.user._id || req.user.id,
      title: title.trim(),
      body: body.trim(),
      priorityLevel: priority,
      expirationDate: expires,
      type: 'global',
    });

    await ann.populate({ path: 'authorId', select: 'id displayName email' });
    
    const doc = ann.toObject();
    return res.status(201).json({ ...doc, id: doc._id.toString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

/**
 * GET /api/announcements/active
 * Get all active broadcasts.
 */
router.get('/active', async (req, res) => {
  try {
    const anns = await Announcement.find({ 
      type: 'global', 
      expirationDate: { $gt: new Date() } 
    }).sort({ createdAt: -1 }).populate({ path: 'authorId', select: 'id displayName' }).lean();

    return res.json(anns.map(a => ({ ...a, id: a._id.toString() })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch active broadcasts' });
  }
});

/**
 * GET /api/announcements/broadcasts
 * Get all broadcasts (for admin dashboard). Requires Admin.
 */
router.get('/broadcasts', protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    const anns = await Announcement.find({ type: 'global' }).sort({ createdAt: -1 }).populate({ path: 'authorId', select: 'id displayName' }).lean();
    
    return res.json(anns.map(a => ({ ...a, id: a._id.toString() })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

/**
 * DELETE /api/announcements/broadcasts/:id
 * Delete a broadcast. Requires Admin.
 */
router.delete('/broadcasts/:id', protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    const ann = await Announcement.findOneAndDelete({ _id: req.params.id, type: 'global' });
    if (!ann) return res.status(404).json({ error: 'Broadcast not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

module.exports = router;