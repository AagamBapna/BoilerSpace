import { Router } from 'express';
import Club from '../models/Club.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/clubs
 * List clubs (optional filter by category). Public.
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const clubs = await Club.find(filter)
      .populate('organizerId', 'id name email')
      .sort({ name: 1 })
      .lean();
    const normalized = clubs.map((c) => ({
      ...c,
      id: c._id.toString(),
      organizer: c.organizerId,
      organizerId: c.organizerId?._id?.toString() ?? c.organizerId,
    }));
    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch clubs' });
  }
});

/**
 * GET /api/clubs/:id
 * Get a single club profile. Public.
 */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id)
      .populate('organizerId', 'id name email')
      .lean();
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    const normalized = {
      ...club,
      id: club._id.toString(),
      organizer: club.organizerId,
      organizerId: club.organizerId?._id?.toString() ?? club.organizerId,
    };
    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch club' });
  }
});

/**
 * POST /api/clubs
 * Create a club. Requires auth; creator becomes organizer.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, contactInfo, category } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Club name is required.',
        fields: { name: 'Name is required' },
      });
    }
    const club = await Club.create({
      name: name.trim(),
      description: description?.trim() ?? undefined,
      contactInfo: contactInfo?.trim() ?? undefined,
      category: category?.trim() ?? undefined,
      organizerId: req.userId,
    });
    await club.populate('organizerId', 'id name email');
    const doc = club.toObject();
    const normalized = {
      ...doc,
      id: doc._id.toString(),
      organizer: doc.organizerId,
      organizerId: doc.organizerId?._id?.toString() ?? doc.organizerId,
    };
    return res.status(201).json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to create club' });
  }
});

/**
 * PATCH /api/clubs/:id
 * Update club. Only the organizer can update.
 */
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    if (String(club.organizerId) !== req.userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to edit this club.',
      });
    }
    const { name, description, contactInfo, category } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Club name cannot be empty.',
          fields: { name: 'Name is required' },
        });
      }
      club.name = name.trim();
    }
    if (description !== undefined) club.description = description?.trim() ?? undefined;
    if (contactInfo !== undefined) club.contactInfo = contactInfo?.trim() ?? undefined;
    if (category !== undefined) club.category = category?.trim() ?? undefined;

    await club.save();
    await club.populate('organizerId', 'id name email');
    const doc = club.toObject();
    const normalized = {
      ...doc,
      id: doc._id.toString(),
      organizer: doc.organizerId,
      organizerId: doc.organizerId?._id?.toString() ?? doc.organizerId,
    };
    return res.json(normalized);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update club' });
  }
});

export default router;
