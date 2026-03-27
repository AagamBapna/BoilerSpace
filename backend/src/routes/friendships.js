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

        // Find all public users sharing at least one course (excluding self)
        const classmates = await User.find({
            _id: { $ne: me._id },
            courses: { $in: courseIds },
            profileVisibility: { $ne: 'private' },
        })
            .select('displayName major year profilePictureUrl courses')
            .populate('courses', 'courseCode title');

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
                major: user.major,
                year: user.year,
                profilePictureUrl: user.profilePictureUrl,
                friendship: friendship
                    ? { id: friendship.id, status: friendship.status, direction: friendship.direction }
                    : null,
            };

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

module.exports = router;
