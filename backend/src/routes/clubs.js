const express = require('express');
const router = express.Router();
const Club = require('../models/Club');
const ClubMember = require('../models/ClubMember');
const User = require('../models/User');
const Announcement = require('../models/Announcement');
const Event = require('../models/Event');
const { protect } = require('../middleware/auth');
const {
  ROLE_RANK,
  DEFAULT_POSITION,
  normalizeRole,
  normalizePosition,
  normalizeAllowedPositions,
  resolveClubAccess,
  requireClubRole,
} = require('../middleware/clubRoleAccess');

function positionExists(positions, value) {
  return positions.some((p) => p.toLowerCase() === String(value || '').toLowerCase());
}

function canManageTarget(requesterRole, targetRole) {
  if (requesterRole === 'admin') return true;
  const requesterRank = ROLE_RANK[requesterRole] || 0;
  const targetRank = ROLE_RANK[targetRole] || 0;
  return targetRank < requesterRank;
}

async function upsertClubMemberRole({ clubId, userId, role, position }) {
  await ClubMember.findOneAndUpdate(
    { clubId, userId: String(userId) },
    {
      $set: {
        role,
        position: normalizePosition(position),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

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
    if (existingClubIds.includes(clubIdStr)) {
      return res.json({ success: true, alreadyMember: true, clubId: clubIdStr });
    }

    if (pendingClubIds.includes(clubIdStr)) {
      return res.json({ success: true, alreadyPending: true, clubId: clubIdStr });
    }

    user.pendingClubIds = [...pendingClubIds, clubIdStr];
    user.removedClubIds = (Array.isArray(user.removedClubIds) ? user.removedClubIds.map(String) : []).filter((id) => id !== clubIdStr);
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
    await Promise.all([
      user.save(),
      ClubMember.deleteOne({ clubId: club._id, userId: String(userId) }),
    ]);

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
router.get('/:id/members', protect, requireClubRole('officer'), async (req, res) => {
  try {
    const club = req.club;

    const members = await User.find({ clubIds: club._id.toString() })
      .select('_id displayName email major year')
      .lean();

    const membershipRows = await ClubMember.find({ clubId: club._id }).lean();
    const membershipByUserId = new Map(membershipRows.map((row) => [String(row.userId), row]));
    const organizerIds = new Set((club.organizerIds || []).map(String));
    const allowedPositions = normalizeAllowedPositions(club.allowedPositions);

    const normalized = members.map((m) => ({
      ...m,
      id: m._id.toString(),
      role: organizerIds.has(String(m._id)) ? 'admin' : normalizeRole(membershipByUserId.get(String(m._id))?.role) || 'member',
      position: (() => {
        if (organizerIds.has(String(m._id))) return 'Organizer';
        const candidate = normalizePosition(membershipByUserId.get(String(m._id))?.position);
        return positionExists(allowedPositions, candidate) ? candidate : DEFAULT_POSITION;
      })(),
    }));

    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch members' });
  }
});

/**
 * GET /api/clubs/:id/access
 * Members and above: returns the requester's role/position in this club.
 */
router.get('/:id/access', protect, requireClubRole('member'), async (req, res) => {
  return res.json({
    role: req.clubAccess?.role || 'member',
    position: req.clubAccess?.position || DEFAULT_POSITION,
    isOrganizer: Boolean(req.clubAccess?.isOrganizer),
  });
});

/**
 * GET /api/clubs/:id/positions
 * Members and above: list assignable positions for this club.
 */
router.get('/:id/positions', protect, requireClubRole('member'), async (req, res) => {
  return res.json({ positions: normalizeAllowedPositions(req.club.allowedPositions) });
});

/**
 * POST /api/clubs/:id/positions
 * Admin-only: create a custom position for this club.
 */
router.post('/:id/positions', protect, requireClubRole('admin'), async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Position name is required.',
      });
    }

    const positions = normalizeAllowedPositions(req.club.allowedPositions);
    if (positionExists(positions, name)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Position already exists for this club.',
      });
    }

    req.club.allowedPositions = [...positions, name];
    await req.club.save();

    return res.status(201).json({ positions: normalizeAllowedPositions(req.club.allowedPositions) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create position' });
  }
});

/**
 * PATCH /api/clubs/:id/positions/:positionName
 * Admin-only: rename a custom position.
 */
router.patch('/:id/positions/:positionName', protect, requireClubRole('admin'), async (req, res) => {
  try {
    const oldName = String(req.params.positionName || '').trim();
    const newName = String(req.body?.name || '').trim();
    if (!oldName || !newName) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Both current and new position names are required.',
      });
    }

    const positions = normalizeAllowedPositions(req.club.allowedPositions);
    const oldIndex = positions.findIndex((p) => p.toLowerCase() === oldName.toLowerCase());
    if (oldIndex < 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    if (positionExists(positions, newName) && positions[oldIndex].toLowerCase() !== newName.toLowerCase()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'A position with that name already exists.',
      });
    }

    positions[oldIndex] = newName;
    req.club.allowedPositions = normalizeAllowedPositions(positions);
    await req.club.save();

    await ClubMember.updateMany(
      { clubId: req.club._id, position: new RegExp(`^${oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      { $set: { position: newName } }
    );

    return res.json({ positions: normalizeAllowedPositions(req.club.allowedPositions) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update position' });
  }
});

/**
 * DELETE /api/clubs/:id/positions/:positionName
 * Admin-only: delete a custom position if it is not currently assigned.
 */
router.delete('/:id/positions/:positionName', protect, requireClubRole('admin'), async (req, res) => {
  try {
    const positionName = String(req.params.positionName || '').trim();
    if (!positionName) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Position name is required.',
      });
    }

    if (positionName.toLowerCase() === DEFAULT_POSITION.toLowerCase()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'The default Member position cannot be deleted.',
      });
    }

    const positions = normalizeAllowedPositions(req.club.allowedPositions);
    if (!positionExists(positions, positionName)) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const inUse = await ClubMember.exists({
      clubId: req.club._id,
      position: new RegExp(`^${positionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (inUse) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Cannot delete a position that is currently assigned to members.',
      });
    }

    req.club.allowedPositions = positions.filter((p) => p.toLowerCase() !== positionName.toLowerCase());
    await req.club.save();

    return res.json({ positions: normalizeAllowedPositions(req.club.allowedPositions) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete position' });
  }
});

/**
 * PATCH /api/clubs/:id/members/:userId/role
 * Officer/Admin: update member role and/or position.
 */
router.patch('/:id/members/:userId/role', protect, requireClubRole('officer'), async (req, res) => {
  try {
    const club = req.club;
    const requester = req.clubAccess;
    const targetId = String(req.params.userId || '').trim();

    if (!targetId) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'User ID is required.',
      });
    }

    const hasRoleUpdate = req.body?.role !== undefined;
    const hasPositionUpdate = req.body?.position !== undefined;
    if (!hasRoleUpdate && !hasPositionUpdate) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'At least one of role or position must be provided.',
      });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const clubIdStr = String(club._id);
    const targetClubIds = Array.isArray(targetUser.clubIds) ? targetUser.clubIds.map(String) : [];
    if (!targetClubIds.includes(clubIdStr)) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Target user is not a member of this club.',
      });
    }

    const targetAccess =
      (await resolveClubAccess(club, targetId)) ||
      {
        role: 'member',
        position: DEFAULT_POSITION,
      };

    if (String(requester.userId) === targetId && requester.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can modify their own role or position.',
      });
    }

    if (!canManageTarget(requester.role, targetAccess.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You cannot modify members with equal or higher role privileges.',
      });
    }

    const desiredRole = hasRoleUpdate ? normalizeRole(req.body.role) : targetAccess.role;
    if (!desiredRole) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Role must be one of: member, officer, admin.',
      });
    }

    if ((ROLE_RANK[desiredRole] || 0) > (ROLE_RANK[requester.role] || 0)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You cannot assign a role higher than your own.',
      });
    }

    if (desiredRole === 'admin' && requester.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can assign admin role.',
      });
    }

    const allowedPositions = normalizeAllowedPositions(club.allowedPositions);
    const desiredPosition = hasPositionUpdate ? normalizePosition(req.body.position) : normalizePosition(targetAccess.position);
    if (!positionExists(allowedPositions, desiredPosition) && desiredPosition !== 'Organizer') {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Position is not valid for this club.',
      });
    }

    const organizerIds = (club.organizerIds || []).map(String);
    const targetIsOrganizer = organizerIds.includes(targetId);

    if (targetIsOrganizer && desiredRole !== 'admin' && organizerIds.length <= 1) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'At least one organizer/admin is required.',
      });
    }

    if (desiredRole === 'admin') {
      if (!organizerIds.includes(targetId)) {
        club.organizerIds = [...organizerIds, targetId];
      }
    } else if (targetIsOrganizer) {
      club.organizerIds = organizerIds.filter((id) => id !== targetId);
    }

    const finalPosition = desiredRole === 'admin' ? 'Organizer' : desiredPosition;
    await upsertClubMemberRole({
      clubId: club._id,
      userId: targetId,
      role: desiredRole,
      position: finalPosition,
    });

    await club.save();

    return res.json({
      success: true,
      member: {
        id: targetId,
        role: desiredRole,
        position: finalPosition,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update member role or position' });
  }
});

/**
 * GET /api/clubs/:id/pending-members
 * Organizer-only: list pending join requests for the club.
 */
router.get('/:id/pending-members', protect, requireClubRole('officer'), async (req, res) => {
  try {
    const club = req.club;

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

    await upsertClubMemberRole({
      clubId: club._id,
      userId: targetId,
      role: 'member',
      position: DEFAULT_POSITION,
    });

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

    await upsertClubMemberRole({
      clubId: club._id,
      userId: targetId,
      role: 'admin',
      position: 'Organizer',
    });

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

    await upsertClubMemberRole({
      clubId: club._id,
      userId: targetId,
      role: 'member',
      position: DEFAULT_POSITION,
    });

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
    await Promise.all([
      targetUser.save(),
      club.save(),
      ClubMember.deleteOne({ clubId: club._id, userId: targetId }),
    ]);

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
router.get('/:id/announcements', protect, requireClubRole('officer'), async (req, res) => {
  try {
    const club = req.club;

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
router.post('/', async (req, res) => {
  const { name, description, contactInfo, category, organizerId, organizerIds, allowedPositions } = req.body;
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
  try {
    const club = await Club.create({
      name: name.trim(),
      description: normalizedDescription,
      contactInfo: normalizedContactInfo,
      category: normalizedCategory,
      organizerIds: finalOrganizerIds,
      allowedPositions: normalizeAllowedPositions(allowedPositions),
    });

    if (finalOrganizerIds.length > 0) {
      await ClubMember.bulkWrite(
        finalOrganizerIds.map((uid) => ({
          updateOne: {
            filter: { clubId: club._id, userId: String(uid) },
            update: {
              $set: {
                role: 'admin',
                position: 'Organizer',
              },
            },
            upsert: true,
          },
        }))
      );
    }

    const doc = club.toObject();
    return res.status(201).json({ ...doc, id: doc._id.toString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create club' });
  }
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
      ClubMember.deleteMany({ clubId: club._id }),
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
