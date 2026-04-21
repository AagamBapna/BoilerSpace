const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { protect } = require('../middleware/auth');

/**
 * GET /api/announcements
 * Returns a global announcements feed with event and club context.
 */
router.get('/', protect, async (req, res) => {
  try {
    const announcements = await Announcement.find({})
      .populate({ path: 'authorId', select: 'displayName email' })
      .populate({ path: 'clubId', select: 'name category' })
      .populate({
        path: 'eventId',
        select: 'title date time clubId',
        populate: { path: 'clubId', select: 'name category' },
      })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = announcements.map((a) => {
      const clubFromEvent = a.eventId?.clubId;
      const fallbackClub = a.clubId;
      const club = clubFromEvent || fallbackClub || null;

      return {
        ...a,
        id: a._id.toString(),
        author: a.authorId,
        authorId: a.authorId?._id?.toString() ?? (a.authorId ? String(a.authorId) : undefined),
        event: a.eventId,
        eventId: a.eventId?._id?.toString(),
        club,
        clubId: club?._id?.toString(),
      };
    });

    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch announcements feed' });
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
 * Get the most recent active broadcast.
 */
router.get('/active', async (req, res) => {
  try {
    const ann = await Announcement.findOne({ 
      type: 'global', 
      expirationDate: { $gt: new Date() } 
    }).sort({ createdAt: -1 }).populate({ path: 'authorId', select: 'id displayName' }).lean();

    if (!ann) return res.json(null);
    return res.json({ ...ann, id: ann._id.toString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch active broadcast' });
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
