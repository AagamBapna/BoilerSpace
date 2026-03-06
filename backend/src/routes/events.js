const express = require('express');
const router = express.Router();
const Club = require('../models/Club');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth'); // only protect now

/**
 * GET /api/events
 * Only authenticated users can access
 */
router.get('/', protect, async (req, res) => {
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
        populate: { path: 'organizerIds', select: 'id name' },
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
 * Only authenticated users can access
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate({
        path: 'clubId',
        select: 'id name category contactInfo',
        populate: { path: 'organizerIds', select: 'id name email' },
      })
      .lean();

    if (!event) return res.status(404).json({ error: 'Event not found' });

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
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, date, time, location, clubId } = req.body;

    if (!title || !title.trim())
      return res.status(400).json({ error: 'Validation failed', fields: { title: 'Title is required' } });
    if (!date || !date.trim())
      return res.status(400).json({ error: 'Validation failed', fields: { date: 'Date is required' } });
    if (!location || !location.trim())
      return res.status(400).json({ error: 'Validation failed', fields: { location: 'Location is required' } });
    if (!clubId || !clubId.trim())
      return res.status(400).json({ error: 'Validation failed', fields: { clubId: 'Club is required' } });

    const club = await Club.findById(clubId);
    if (!club) return res.status(404).json({ error: 'Club not found' });
    // make sure user is one of the club organizers
    if (!Array.isArray(club.organizerIds) || !club.organizerIds.map(String).includes(String(req.user.id)))
      return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to create events for this club.' });

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
      populate: { path: 'organizerIds', select: 'id name' },
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

module.exports = router;