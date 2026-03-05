const express = require('express');
const router = express.Router();
const Club = require('../models/Club');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

async function getOrganizerClub(req, res) {
  const club = await Club.findById(req.params.id);
  if (!club) {
    res.status(404).json({ error: 'Club not found' });
    return null;
  }

  const organizerIds = Array.isArray(club.organizerIds) ? club.organizerIds.map(String) : [];
  const requesterId = req.user?.id || req.user?._id;
  if (!requesterId || !organizerIds.includes(String(requesterId))) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to manage this club.',
    });
    return null;
  }

  return club;
}

/**
 * GET /api/clubs
 * returns all clubs, sorted by name. optional query param filters by category.
 */
router.get('/', (req, res) => {
  const { category } = req.query;
  const filter = category ? { category } : {};
  Club.find(filter)
    .sort({ name: 1 })
    .lean()
    .then((clubs) => {
      const list = clubs.map((c) => ({ ...c, id: c._id.toString() }));
      res.json(list);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch clubs' });
    });
});

/**
 * GET /api/clubs/:id
 * returns a single club profile by ID. Used for the club detail page.
 */
router.get('/:id', (req, res) => {
  Club.findById(req.params.id)
    .lean()
    .then((club) => {
      if (!club) return res.status(404).json({ error: 'Club not found' });
      res.json({ ...club, id: club._id.toString() });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch club' });
    });
});

/**
 * GET /api/clubs/:id/members
 * Organizer-only: list current members for management dashboard.
 */
router.get('/:id/members', protect, async (req, res) => {
  try {
    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const members = await User.find({ clubIds: club._id.toString() })
      .select('_id displayName email major year')
      .lean();

    const normalized = members.map((m) => ({
      ...m,
      id: m._id.toString(),
    }));

    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch members' });
  }
});

/**
 * POST /api/clubs/:id/organizers
 * Organizer-only: promote an existing user to organizer.
 */
router.post('/:id/organizers', protect, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !String(userId).trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: { userId: 'User ID is required' },
      });
    }

    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const targetUser = await User.findById(String(userId).trim());
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetId = targetUser._id.toString();
    if (!club.organizerIds.map(String).includes(targetId)) {
      club.organizerIds.push(targetId);
    }

    if (!Array.isArray(targetUser.clubIds)) targetUser.clubIds = [];
    if (!targetUser.clubIds.map(String).includes(club._id.toString())) {
      targetUser.clubIds.push(club._id.toString());
    }

    await Promise.all([club.save(), targetUser.save()]);
    return res.status(201).json({ success: true, organizerIds: club.organizerIds });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to add organizer' });
  }
});

/**
 * DELETE /api/clubs/:id/members/:userId
 * Organizer-only: remove a member from club membership.
 */
router.delete('/:id/members/:userId', protect, async (req, res) => {
  try {
    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetId = targetUser._id.toString();
    if (club.organizerIds.map(String).includes(targetId)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Use organizer management to remove organizer access first.',
      });
    }

    targetUser.clubIds = (targetUser.clubIds || []).map(String).filter((clubId) => clubId !== club._id.toString());
    await targetUser.save();

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

/**
 * POST /api/clubs
 * creates a new club. required fields are validated; missing required fields
 * return 400 with a clear message and field names.
 */
router.post('/', (req, res) => {
  const { name, description, contactInfo, category, organizerId, organizerIds } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Club name is required.',
      fields: { name: 'Name is required' },
    });
  }
  // accept either a single `organizerId` (string) or `organizerIds` (array)
  let finalOrganizerIds = [];
  if (Array.isArray(organizerIds) && organizerIds.length > 0) {
    finalOrganizerIds = organizerIds.map((s) => String(s).trim()).filter(Boolean);
  } else if (organizerId && typeof organizerId === 'string' && organizerId.trim()) {
    finalOrganizerIds = [organizerId.trim()];
  }
  if (finalOrganizerIds.length === 0) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Organizer is required.',
      fields: { organizerIds: 'Organizer is required' },
    });
  }
  Club.create({
    name: name.trim(),
    description: (description != null && String(description).trim()) || '',
    contactInfo: (contactInfo != null && String(contactInfo).trim()) || '',
    category: (category != null && String(category).trim()) || '',
    organizerIds: finalOrganizerIds,
  })
    .then((club) => {
      const doc = club.toObject();
      res.status(201).json({ ...doc, id: doc._id.toString() });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to create club' });
    });
});

/**
 * PATCH /api/clubs/:id
 * Updates an existing club. Only the organizer may update; the client must send
 * the current user's id in the X-User-Id header (auth is handled elsewhere).
 * If X-User-Id does not match the club's organizerId, returns 403.
 */
router.patch('/:id', (req, res) => {
  const requesterId = req.headers['x-user-id'];
  if (!requesterId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication is required to edit this club.',
    });
  }
  Club.findById(req.params.id)
    .then((club) => {
      if (!club) {
        res.status(404).json({ error: 'Club not found' });
        return null;
      }
      const organizerIds = Array.isArray(club.organizerIds) ? club.organizerIds.map(String) : [];
      if (!organizerIds.includes(String(requesterId))) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to edit this club.',
        });
        return null;
      }
      const { name, description, contactInfo, category } = req.body;
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          res.status(400).json({
            error: 'Validation failed',
            message: 'Club name cannot be empty.',
            fields: { name: 'Name is required' },
          });
          return null;
        }
        club.name = name.trim();
      }
      if (description !== undefined) club.description = String(description).trim();
      if (contactInfo !== undefined) club.contactInfo = String(contactInfo).trim();
      if (category !== undefined) club.category = String(category).trim();
      return club.save();
    })
    .then((club) => {
      if (!club) return;
      const doc = club.toObject();
      res.json({ ...doc, id: doc._id.toString() });
    })
    .catch((err) => {
      console.error(err);
      if (!res.headersSent) res.status(500).json({ error: 'Failed to update club' });
    });
});

module.exports = router;
