const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const { protect } = require('../middleware/auth');

// GET /api/friendships/classmates — discover classmates grouped by shared course
router.get('/classmates', protect, async (req, res) => {
    try {
        const me = await User.findById(req.user._id).populate('courses');
        if (!me || me.courses.length === 0) {
            return res.json([]);
        }

        const courseIds = me.courses.map(c => c._id);

        // Public users sharing a course (excl. self).
        const classmates = await User.find({
            _id: { $ne: me._id },
            courses: { $in: courseIds },
            profileVisibility: { $ne: 'private' },
        })
            .select('displayName major year profilePictureUrl courses fieldVisibility')
            .populate('courses', 'courseCode title');

        // Legacy-doc fallbacks.
        const FIELD_DEFAULTS = { major: 'public', year: 'public' };
        const isPrivate = (user, field) => {
            const fv = user.fieldVisibility && typeof user.fieldVisibility === 'object'
                ? user.fieldVisibility
                : {};
            return (fv[field] || FIELD_DEFAULTS[field]) === 'private';
        };

        // Get all friendships involving current user
        const friendships = await Friendship.find({
            $or: [{ requester: me._id }, { recipient: me._id }],
        });

        const friendshipMap = {};
        for (const f of friendships) {
            const otherId =
                f.requester.toString() === me._id.toString()
                    ? f.recipient.toString()
                    : f.requester.toString();
            friendshipMap[otherId] = {
                id: f._id,
                status: f.status,
                direction:
                    f.requester.toString() === me._id.toString()
                        ? 'outgoing'
                        : 'incoming',
            };
        }

        // Group by shared course
        const grouped = {};
        for (const course of me.courses) {
            const key = course._id.toString();
            grouped[key] = {
                courseId: course._id,
                courseCode: course.courseCode,
                courseTitle: course.title,
                classmates: [],
            };
        }

        for (const user of classmates) {
            const sharedCourseIds = user.courses
                .filter(c => courseIds.some(id => id.toString() === c._id.toString()))
                .map(c => c._id.toString());

            const friendship = friendshipMap[user._id.toString()] || null;

            const classmateData = {
                _id: user._id,
                displayName: user.displayName,
                profilePictureUrl: user.profilePictureUrl,
                friendship: friendship
                    ? { id: friendship.id, status: friendship.status, direction: friendship.direction }
                    : null,
            };
            // Respect per-field privacy.
            if (!isPrivate(user, 'major')) classmateData.major = user.major;
            if (!isPrivate(user, 'year')) classmateData.year = user.year;

            for (const cid of sharedCourseIds) {
                if (grouped[cid]) {
                    grouped[cid].classmates.push(classmateData);
                }
            }
        }

        // Filter out courses with no classmates
        const result = Object.values(grouped).filter(g => g.classmates.length > 0);
        res.json(result);
    } catch (err) {
        console.error('Error fetching classmates:', err);
        res.status(500).json({ error: 'Failed to fetch classmates' });
    }
});

// POST /api/friendships/request — send a friend request
router.post('/request', protect, async (req, res) => {
    try {
        const { recipientId } = req.body;
        if (!recipientId) {
            return res.status(400).json({ error: 'recipientId is required' });
        }

        if (req.user._id.toString() === recipientId) {
            return res.status(400).json({ error: 'Cannot send a friend request to yourself' });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (recipient.profileVisibility === 'private') {
            return res.status(403).json({ error: 'Cannot send a friend request to a private user' });
        }

        // Check for existing friendship in either direction
        const existing = await Friendship.findOne({
            $or: [
                { requester: req.user._id, recipient: recipientId },
                { requester: recipientId, recipient: req.user._id },
            ],
        });

        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(400).json({ error: 'Already friends' });
            }
            if (existing.status === 'pending') {
                return res.status(400).json({ error: 'Friend request already exists' });
            }
            // If rejected, allow re-requesting by updating
            existing.requester = req.user._id;
            existing.recipient = recipientId;
            existing.status = 'pending';
            await existing.save();
            return res.status(201).json(existing);
        }

        const friendship = await Friendship.create({
            requester: req.user._id,
            recipient: recipientId,
        });

        res.status(201).json(friendship);
    } catch (err) {
        console.error('Error sending friend request:', err);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

// PUT /api/friendships/:id/accept — accept a friend request (recipient only)
router.put('/:id/accept', protect, async (req, res) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        if (friendship.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the recipient can accept a friend request' });
        }

        if (friendship.status !== 'pending') {
            return res.status(400).json({ error: 'This request is no longer pending' });
        }

        friendship.status = 'accepted';
        await friendship.save();
        res.json(friendship);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Friend request not found' });
        }
        console.error('Error accepting friend request:', err);
        res.status(500).json({ error: 'Failed to accept friend request' });
    }
});

// PUT /api/friendships/:id/reject — reject a friend request (recipient only)
router.put('/:id/reject', protect, async (req, res) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Friend request not found' });
        }

        if (friendship.recipient.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the recipient can reject a friend request' });
        }

        if (friendship.status !== 'pending') {
            return res.status(400).json({ error: 'This request is no longer pending' });
        }

        friendship.status = 'rejected';
        await friendship.save();
        res.json(friendship);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Friend request not found' });
        }
        console.error('Error rejecting friend request:', err);
        res.status(500).json({ error: 'Failed to reject friend request' });
    }
});

// GET /api/friendships/pending — get pending friend requests (incoming + outgoing)
router.get('/pending', protect, async (req, res) => {
    try {
        const incoming = await Friendship.find({
            recipient: req.user._id,
            status: 'pending',
        }).populate('requester', 'displayName major year profilePictureUrl');

        const outgoing = await Friendship.find({
            requester: req.user._id,
            status: 'pending',
        }).populate('recipient', 'displayName major year profilePictureUrl');

        res.json({ incoming, outgoing });
    } catch (err) {
        console.error('Error fetching pending requests:', err);
        res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
});

// GET /api/friendships/friends — list accepted friends
router.get('/friends', protect, async (req, res) => {
    try {
        const friendships = await Friendship.find({
            $or: [{ requester: req.user._id }, { recipient: req.user._id }],
            status: 'accepted',
        })
            .populate('requester', 'displayName major year profilePictureUrl courses')
            .populate('recipient', 'displayName major year profilePictureUrl courses');

        const friends = friendships.map(f => {
            const friend =
                f.requester._id.toString() === req.user._id.toString()
                    ? f.recipient
                    : f.requester;
            return {
                friendshipId: f._id,
                ...friend.toObject(),
            };
        });

        res.json(friends);
    } catch (err) {
        console.error('Error fetching friends:', err);
        res.status(500).json({ error: 'Failed to fetch friends' });
    }
});

// DELETE /api/friendships/:id — unfriend or cancel request (either party)
router.delete('/:id', protect, async (req, res) => {
    try {
        const friendship = await Friendship.findById(req.params.id);
        if (!friendship) {
            return res.status(404).json({ error: 'Friendship not found' });
        }

        const userId = req.user._id.toString();
        if (
            friendship.requester.toString() !== userId &&
            friendship.recipient.toString() !== userId
        ) {
            return res.status(403).json({ error: 'Not authorized to delete this friendship' });
        }

        await Friendship.findByIdAndDelete(req.params.id);
        res.json({ message: 'Friendship removed' });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Friendship not found' });
        }
        console.error('Error deleting friendship:', err);
        res.status(500).json({ error: 'Failed to delete friendship' });
    }
});

module.exports = router;
