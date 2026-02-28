const express = require('express');
const router = express.Router();
const Course = require('../models/Course');

router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.department) {
            filter.department = req.query.department.toUpperCase();
        }
        if (req.query.semester) {
            filter.semester = req.query.semester;
        }

        const courses = await Course.find(filter).sort({ courseCode: 1 });
        res.json(courses);
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        res.json(course);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Course not found' });
        }
        console.error('Error fetching course:', err);
        res.status(500).json({ error: 'Failed to fetch course' });
    }
});

module.exports = router;