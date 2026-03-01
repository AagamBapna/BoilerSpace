const express = require('express');
const router = express.Router();
const Course = require('../models/Course');

// GET /api/courses — all courses sorted by code
router.get('/', async (req, res) => {
    try {
        const { department, semester, search } = req.query;
        let filter = {};

        if (department) {
            filter.department = new RegExp(`^${department}$`, 'i');
        }
        if (semester) {
            filter.semester = new RegExp(`^${semester}$`, 'i');
        }
        if (search) {
            filter.$or = [
                { code: new RegExp(search, 'i') },
                { title: new RegExp(search, 'i') },
            ];
        }

        const courses = await Course.find(filter).sort({ code: 1 });
        res.json(courses);
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// GET /api/courses/:id — single course by ID
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
