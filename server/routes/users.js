const express = require('express');
const router = express.Router();
const { users, courses } = require('../data');
const { authUser } = require('../authenticator/authUser');

// GET /api/users/:id, get user by ID
router.get('/:id', authUser, (req, res) => {
    const user = users.find((u) => u._id === req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    const { password, ...safeUser } = user;
    const userCourses = user.courses
        .map(courseId => courses.find(c => c._id === courseId))
        .filter(Boolean);
    res.json({ ...safeUser, courses: userCourses });
});

// GET /api/users/:id/courses, get user's enrolled courses
router.get('/:id/courses', (req, res) => {
    const user = users.find((u) => u._id === req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    const userCourses = user.courses
        .map(courseId => courses.find(c => c._id === courseId))
        .filter(Boolean);
    res.json(userCourses);
});

// POST /api/users/:id/courses, update user's enrolled courses
function handleCourseUpdate(req, res) {
    const { courseIds } = req.body;
    if (!courseIds || !Array.isArray(courseIds)) {
        return res.status(400).json({ error: 'courseIds must be an array of course IDs'});
    }
    const userIndex = users.findIndex((u) => u._id === req.params.id);
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found' });
    }
    if (req.user._id !== req.params.id) {
        return res.status(403).json({ error: 'You can only update your own courses' });
    }
    const invalidCourses = courseIds.filter(
        id => !courses.find(c => c._id === id)
    );
    if (invalidCourses.length > 0) {
        return res.status(400).json({ error: 'Invalid course IDs provided', invalidIds: invalidCourses });
    }
    const uniqueCourseIds = [...new Set(courseIds)];
    users[userIndex].courses = uniqueCourseIds;
    const updatedCourses = uniqueCourseIds
        .map(courseId => courses.find(c => c._id === courseId))
        .filter(Boolean);
    res.json({
        message: 'Courses updated successfully',
        courses: updatedCourses
    });
}
router.post('/:id/courses', authUser, handleCourseUpdate);
module.exports = router;