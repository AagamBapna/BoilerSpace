const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/Course');
const { protect } = require('../middleware/auth');

// GET /api/users/:id — get user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('courses');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'User not found' });
        }
        console.error('Error fetching user:', err);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// GET /api/users/:id/courses — get user's enrolled courses
router.get('/:id/courses', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate('courses');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.courses);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'User not found' });
        }
        console.error('Error fetching user courses:', err);
        res.status(500).json({ error: 'Failed to fetch user courses' });
    }
});

/**
 * Helper: validate and save courses for a user.
 * Shared by POST and PUT handlers.
 */
async function handleCourseUpdate(req, res) {
    try {
        const { courseIds } = req.body;

        if (!courseIds || !Array.isArray(courseIds)) {
            return res.status(400).json({
                error: 'courseIds must be an array of course IDs'
            });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Authorization: users can only update their own courses
        if (req.user._id.toString() !== req.params.id) {
            return res.status(403).json({ error: 'You can only update your own courses' });
        }

        // Validate all course IDs exist in the database
        const uniqueCourseIds = [...new Set(courseIds)];
        const foundCourses = await Course.find({ _id: { $in: uniqueCourseIds } });

        if (foundCourses.length !== uniqueCourseIds.length) {
            const foundIds = foundCourses.map(c => c._id.toString());
            const invalidIds = uniqueCourseIds.filter(id => !foundIds.includes(id));
            return res.status(400).json({
                error: 'Invalid course IDs provided',
                invalidIds
            });
        }

        // Replace user's courses entirely
        user.courses = uniqueCourseIds;
        await user.save();

        // Return populated courses
        const updatedUser = await User.findById(req.params.id).populate('courses');

        res.json({
            message: 'Courses updated successfully',
            courses: updatedUser.courses
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({
                error: 'Invalid course IDs provided',
                invalidIds: [req.body.courseIds?.find(id => !id.match(/^[0-9a-fA-F]{24}$/))]
            });
        }
        console.error('Error updating courses:', err);
        res.status(500).json({ error: 'Failed to update courses' });
    }
}

// POST /api/users/:id/courses — set user's courses for the semester
router.post('/:id/courses', protect, handleCourseUpdate);

// PUT /api/users/:id/courses — update user's courses (alias)
router.put('/:id/courses', protect, handleCourseUpdate);

module.exports = router;
