const Club = require('../models/Club');
const ClubMember = require('../models/ClubMember');

const ROLE_RANK = {
  member: 1,
  officer: 2,
  admin: 3,
};

const DEFAULT_POSITION = 'Member';

function normalizeRole(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (!ROLE_RANK[normalized]) return null;
  return normalized;
}

function normalizePosition(position) {
  const normalized = String(position || '').trim();
  if (!normalized) return DEFAULT_POSITION;
  return normalized;
}

function normalizeAllowedPositions(positions) {
  const list = Array.isArray(positions) ? positions : [];
  const unique = [];
  for (const raw of list) {
    const value = String(raw || '').trim();
    if (!value) continue;
    if (!unique.some((p) => p.toLowerCase() === value.toLowerCase())) {
      unique.push(value);
    }
  }
  if (!unique.some((p) => p.toLowerCase() === DEFAULT_POSITION.toLowerCase())) {
    unique.unshift(DEFAULT_POSITION);
  }
  return unique;
}

async function resolveClubAccess(club, userId) {
  const requesterId = String(userId || '').trim();
  if (!requesterId) return null;

  const organizerIds = Array.isArray(club?.organizerIds) ? club.organizerIds.map(String) : [];
  if (organizerIds.includes(requesterId)) {
    return {
      userId: requesterId,
      role: 'admin',
      position: 'Organizer',
      isOrganizer: true,
    };
  }

  const membership = await ClubMember.findOne({ clubId: club._id, userId: requesterId }).lean();
  if (!membership) return null;

  return {
    userId: requesterId,
    role: normalizeRole(membership.role) || 'member',
    position: normalizePosition(membership.position),
    isOrganizer: false,
  };
}

function requireClubRole(minimumRole = 'member', options = {}) {
  const normalizedMinimum = normalizeRole(minimumRole) || 'member';

  return async (req, res, next) => {
    try {
      const clubId = req.params?.id || req.params?.clubId;
      const club = await Club.findById(clubId);
      if (!club) {
        return res.status(404).json({ error: 'Club not found' });
      }

      const requesterId = req.user?.id || req.user?._id;
      const access = await resolveClubAccess(club, requesterId);
      if (!access) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have permission to access this club.',
        });
      }

      const requesterRank = ROLE_RANK[access.role] || 0;
      const minimumRank = ROLE_RANK[normalizedMinimum] || 0;
      if (requesterRank < minimumRank) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `This action requires ${normalizedMinimum} role or higher.`,
        });
      }

      if (Array.isArray(options.allowedPositions) && options.allowedPositions.length > 0) {
        const allowed = options.allowedPositions.map((p) => String(p).trim().toLowerCase());
        if (!allowed.includes(String(access.position || '').toLowerCase())) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Your club position is not allowed to perform this action.',
          });
        }
      }

      req.club = club;
      req.clubAccess = access;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  ROLE_RANK,
  DEFAULT_POSITION,
  normalizeRole,
  normalizePosition,
  normalizeAllowedPositions,
  resolveClubAccess,
  requireClubRole,
};
