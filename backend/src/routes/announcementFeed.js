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

module.exports = router;
