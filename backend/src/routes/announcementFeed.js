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
      .populate({
        path: 'eventId',
        select: 'title date time clubId',
        populate: { path: 'clubId', select: 'name category' },
      })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = announcements
      .filter((a) => a.eventId)
      .map((a) => ({
        ...a,
        id: a._id.toString(),
        author: a.authorId,
        authorId: a.authorId?._id?.toString() ?? (a.authorId ? String(a.authorId) : undefined),
        event: a.eventId,
        eventId: a.eventId?._id?.toString(),
        club: a.eventId?.clubId,
        clubId: a.eventId?.clubId?._id?.toString(),
      }));

    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch announcements feed' });
  }
});

module.exports = router;
