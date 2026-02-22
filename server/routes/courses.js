const express = require('express');
const router = express.Router();
const { courses } = require('../data');

// GET /api/courses — all courses sorted by code
router.get('/', (req, res) => {
    const { department, semester, search } = req.query;
    
    let filtered = [...courses];
    
    if (department) {
        filtered = filtered.filter(c => 
            c.department.toLowerCase() === department.toLowerCase()
        );
    }
    
    if (semester) {
        filtered = filtered.filter(c => 
            c.semester.toLowerCase() === semester.toLowerCase()
        );
    }
    
    if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(c => 
            c.code.toLowerCase().includes(searchLower) ||
            c.title.toLowerCase().includes(searchLower)
        );
    }
    
    const sorted = filtered.sort((a, b) => a.code.localeCompare(b.code));
    res.json(sorted);
});

// GET /api/courses/:id — single course by ID
router.get('/:id', (req, res) => {
    const course = courses.find((c) => c._id === req.params.id);
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
});

// GET /api/courses/code/:code — course by code (e.g., CS 30700)
router.get('/code/:code', (req, res) => {
    const courseCode = req.params.code.toUpperCase().replace('-', ' ');
    const course = courses.find((c) => c.code === courseCode);
    if (!course) {
        return res.status(404).json({ error: 'Course not found' });
    }
    res.json(course);
});

module.exports = router;
