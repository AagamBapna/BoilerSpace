const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const { protect } = require('../middleware/auth');

// GET /api/courses, all courses sorted by code
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

// GET /api/courses/:id, single course by ID
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

// GET /api/courses/:id/exams, exams for a course sorted chronologically
router.get('/:id/exams', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).select('exams');
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        const exams = [...course.exams].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );
        res.json(exams);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Course not found' });
        }
        console.error('Error fetching course exams:', err);
        res.status(500).json({ error: 'Failed to fetch course exams' });
    }
});

// POST /api/courses/:id/exams, append a new exam to a course (crowdsourced)
router.post('/:id/exams', protect, async (req, res) => {
    try {
        const { title, date, location } = req.body;

        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ error: 'Exam title is required' });
        }
        if (!date) {
            return res.status(400).json({ error: 'Exam date is required' });
        }
        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({ error: 'Exam date must be a valid date' });
        }

        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        course.exams.push({
            title: title.trim(),
            date: parsedDate,
            location: typeof location === 'string' ? location.trim() : '',
        });
        await course.save();

        const exams = [...course.exams].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
        );
        res.status(201).json(exams);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Course not found' });
        }
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: err.message });
        }
        console.error('Error adding course exam:', err);
        res.status(500).json({ error: 'Failed to add course exam' });
    }
});

module.exports = router;