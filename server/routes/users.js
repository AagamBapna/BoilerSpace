const express = require('express');
const router = express.Router();
const { users, courses } = require('../data');

// GET /api/users/:id, get user by ID
router.get('/:id', (req, res) => {
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

module.exports = router;