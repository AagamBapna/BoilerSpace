const express = require('express');
const router = express.Router();
const Club = require('../models/Club');
const User = require('../models/User');
const Announcement = require('../models/Announcement');
const Event = require('../models/Event');
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
 * POST /api/clubs/:id/join
 * Authenticated user joins a club by adding the club id to their membership list.
 */
router.post('/:id/join', protect, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ error: 'Club not found' });

    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const clubIdStr = club._id.toString();
    const existingClubIds = Array.isArray(user.clubIds) ? user.clubIds.map(String) : [];
    const pendingClubIds = Array.isArray(user.pendingClubIds) ? user.pendingClubIds.map(String) : [];
    const removedClubIds = Array.isArray(user.removedClubIds) ? user.removedClubIds.map(String) : [];
    if (existingClubIds.includes(clubIdStr)) {
      return res.json({ success: true, alreadyMember: true, clubId: clubIdStr });
    }

    if (pendingClubIds.includes(clubIdStr)) {
      return res.json({ success: true, alreadyPending: true, clubId: clubIdStr });
    }

    if (removedClubIds.includes(clubIdStr)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You have been removed from this club and cannot request to join again.',
      });
    }

    user.pendingClubIds = [...pendingClubIds, clubIdStr];
    if (Array.isArray(club.pendingMemberIds)) {
      const clubPendingIds = club.pendingMemberIds.map(String);
      if (!clubPendingIds.includes(String(userId))) {
        club.pendingMemberIds = [...clubPendingIds, String(userId)];
      }
    }
    await user.save();
    await club.save();

    return res.status(201).json({ success: true, alreadyMember: false, alreadyPending: false, pendingRequest: true, clubId: clubIdStr });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to join club' });
  }
});

/**
 * POST /api/clubs/:id/leave
 * Authenticated user leaves a club by removing the club id from their membership list.
 */
router.post('/:id/leave', protect, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ error: 'Club not found' });

    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const clubIdStr = club._id.toString();
    const existingClubIds = Array.isArray(user.clubIds) ? user.clubIds.map(String) : [];
    const pendingClubIds = Array.isArray(user.pendingClubIds) ? user.pendingClubIds.map(String) : [];
    if (!existingClubIds.includes(clubIdStr)) {
      const hadPending = pendingClubIds.includes(clubIdStr);
      if (hadPending) {
        user.pendingClubIds = pendingClubIds.filter((id) => id !== clubIdStr);
        club.pendingMemberIds = (club.pendingMemberIds || []).map(String).filter((id) => id !== String(userId));
        await Promise.all([user.save(), club.save()]);
        return res.json({ success: true, alreadyLeft: false, cancelledRequest: true, clubId: clubIdStr });
      }
      return res.json({ success: true, alreadyLeft: true, clubId: clubIdStr });
    }

    user.clubIds = existingClubIds.filter((id) => id !== clubIdStr);
    user.removedClubIds = Array.from(new Set([...(Array.isArray(user.removedClubIds) ? user.removedClubIds.map(String) : []), clubIdStr]));
    await user.save();

    return res.json({ success: true, alreadyLeft: false, clubId: clubIdStr });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to leave club' });
  }
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
 * GET /api/clubs/:id/pending-members
 * Organizer-only: list pending join requests for the club.
 */
router.get('/:id/pending-members', protect, async (req, res) => {
  try {
    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const members = await User.find({ pendingClubIds: club._id.toString() })
      .select('_id displayName email major year')
      .lean();

    const normalized = members.map((m) => ({
      ...m,
      id: m._id.toString(),
    }));

    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch pending members' });
  }
});

/**
 * POST /api/clubs/:id/members/:userId/approve
 * Organizer-only: approve a pending member request.
 */
router.post('/:id/members/:userId/approve', protect, async (req, res) => {
  try {
    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const clubIdStr = club._id.toString();
    const targetId = targetUser._id.toString();
    const pendingClubIds = Array.isArray(targetUser.pendingClubIds) ? targetUser.pendingClubIds.map(String) : [];
    if (!pendingClubIds.includes(clubIdStr)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Selected user does not have a pending request for this club.',
      });
    }

    targetUser.pendingClubIds = pendingClubIds.filter((id) => id !== clubIdStr);
    targetUser.clubIds = Array.from(new Set([...(Array.isArray(targetUser.clubIds) ? targetUser.clubIds.map(String) : []), clubIdStr]));
    targetUser.removedClubIds = (Array.isArray(targetUser.removedClubIds) ? targetUser.removedClubIds.map(String) : []).filter((id) => id !== clubIdStr);
    club.pendingMemberIds = (club.pendingMemberIds || []).map(String).filter((id) => id !== targetId);

    await Promise.all([targetUser.save(), club.save()]);
    return res.json({ success: true, memberIds: targetUser.clubIds });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to approve member' });
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
 * DELETE /api/clubs/:id/organizers/:userId
 * Organizer-only: demote an organizer to a regular member.
 */
router.delete('/:id/organizers/:userId', protect, async (req, res) => {
  try {
    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const targetId = String(req.params.userId || '').trim();
    if (!targetId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'User ID is required.',
      });
    }

    const organizerIds = (club.organizerIds || []).map(String);
    if (!organizerIds.includes(targetId)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Selected user is not an organizer.',
      });
    }

    if (organizerIds.length <= 1) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'At least one organizer is required.',
      });
    }

    club.organizerIds = organizerIds.filter((id) => id !== targetId);
    await club.save();

    return res.json({ success: true, organizerIds: club.organizerIds });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to remove organizer' });
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

    const clubIdStr = club._id.toString();
    targetUser.clubIds = (targetUser.clubIds || []).map(String).filter((clubId) => clubId !== clubIdStr);
    targetUser.pendingClubIds = (targetUser.pendingClubIds || []).map(String).filter((clubId) => clubId !== clubIdStr);
    targetUser.removedClubIds = Array.from(new Set([...(Array.isArray(targetUser.removedClubIds) ? targetUser.removedClubIds.map(String) : []), clubIdStr]));
    club.pendingMemberIds = (club.pendingMemberIds || []).map(String).filter((clubId) => clubId !== targetId);
    await targetUser.save();
    await club.save();

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

/**
 * GET /api/clubs/:id/announcements
 * Organizer-only: list announcements for this club (including event and club-wide).
 */
router.get('/:id/announcements', protect, async (req, res) => {
  try {
    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const anns = await Announcement.find({ clubId: club._id })
      .populate({ path: 'authorId', select: 'id displayName email' })
      .populate({ path: 'eventId', select: 'title date time location' })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = anns.map((a) => ({
      ...a,
      id: a._id.toString(),
      event: a.eventId || null,
      eventId: a.eventId?._id?.toString() || null,
      author: a.authorId,
      authorId: a.authorId?._id?.toString(),
      clubId: club._id.toString(),
    }));

    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch club announcements' });
  }
});

/**
 * POST /api/clubs/:id/announcements
 * Organizer-only: post a club-wide announcement (no event required).
 */
router.post('/:id/announcements', protect, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        fields: { message: 'Message is required' },
      });
    }

    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const ann = await Announcement.create({
      eventId: null,
      clubId: club._id,
      authorId: req.user?._id || req.user?.id,
      message: String(message).trim(),
    });

    await ann.populate({ path: 'authorId', select: 'id displayName email' });
    await ann.populate({ path: 'clubId', select: 'name category' });

    const doc = ann.toObject();
    return res.status(201).json({
      ...doc,
      id: doc._id.toString(),
      eventId: null,
      event: null,
      club: doc.clubId,
      clubId: doc.clubId?._id?.toString(),
      author: doc.authorId,
      authorId: doc.authorId?._id?.toString(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/**
 * DELETE /api/clubs/:id/announcements/:announcementId
 * Organizer-only: delete one announcement from this club.
 */
router.delete('/:id/announcements/:announcementId', protect, async (req, res) => {
  try {
    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const ann = await Announcement.findOne({ _id: req.params.announcementId, clubId: club._id });
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });

    await Announcement.deleteOne({ _id: ann._id });
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

/**
 * POST /api/clubs
 * creates a new club. required fields are validated; missing required fields
 * return 400 with a clear message and field names.
 */
router.post('/', (req, res) => {
  const { name, description, contactInfo, category, organizerId, organizerIds } = req.body;
  const normalizedDescription = description != null ? String(description).trim() : '';
  const normalizedContactInfo = contactInfo != null ? String(contactInfo).trim() : '';
  const normalizedCategory = category != null ? String(category).trim() : '';

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Club name is required.',
      fields: { name: 'Name is required' },
    });
  }
  if (!normalizedDescription) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Club description is required.',
      fields: { description: 'Description is required' },
    });
  }
  if (!normalizedContactInfo) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Contact info is required.',
      fields: { contactInfo: 'Contact info is required' },
    });
  }
  if (!normalizedCategory) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Category is required.',
      fields: { category: 'Category is required' },
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
    description: normalizedDescription,
    contactInfo: normalizedContactInfo,
    category: normalizedCategory,
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

/**
 * DELETE /api/clubs/:id
 * Organizer-only: delete club and related events/announcements, and remove membership links.
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const club = await getOrganizerClub(req, res);
    if (!club) return;

    const clubIdStr = club._id.toString();

    await Promise.all([
      Announcement.deleteMany({ clubId: club._id }),
      Event.deleteMany({ clubId: club._id }),
      User.updateMany(
        { $or: [{ clubIds: clubIdStr }, { pendingClubIds: clubIdStr }] },
        { $pull: { clubIds: clubIdStr, pendingClubIds: clubIdStr } }
      ),
      Club.deleteOne({ _id: club._id }),
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete club' });
  }
});

module.exports = router;
