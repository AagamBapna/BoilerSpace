const express = require('express');
const router = express.Router();
const multer = require('multer');
const Note = require('../models/Note');
const Course = require('../models/Course');
const upload = require('../middleware/upload');
const { protect } = require('../middleware/auth');

// POST /api/courses/:id/notes — upload a note to a course
router.post('/:id/notes', protect, (req, res) => {
    upload.single('file')(req, res, async (err) => {
        // Handle multer errors (file too large, invalid type)
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds the 16MB limit.' });
            }
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            // Validate course exists
            const course = await Course.findById(req.params.id);
            if (!course) {
                return res.status(404).json({ error: 'Course not found.' });
            }

            // Validate file was provided
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded. Please attach a PDF or image file.' });
            }

            const note = await Note.create({
                courseId: course._id,
                uploadedBy: req.user._id,
                title: req.body.title || req.file.originalname,
                description: req.body.description || '',
                fileUrl: `/uploads/${req.file.filename}`,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                fileType: req.file.mimetype,
            });

            // Populate uploader info before returning
            await note.populate('uploadedBy', 'displayName email');
            await note.populate('courseId', 'courseCode title');

            res.status(201).json(note);
        } catch (error) {
            if (error.name === 'CastError') {
                return res.status(404).json({ error: 'Course not found.' });
            }
            console.error('Error uploading note:', error);
            res.status(500).json({ error: 'Failed to upload note.' });
        }
    });
});

// GET /api/courses/:id/notes — retrieve all notes for a course
router.get('/:id/notes', protect, async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found.' });
        }

        const notes = await Note.find({ courseId: course._id })
            .populate('uploadedBy', 'displayName email')
            .populate('courseId', 'courseCode title')
            .sort({ createdAt: -1 });

        res.json(notes);
    } catch (error) {
        if (error.name === 'CastError') {
            return res.status(404).json({ error: 'Course not found.' });
        }
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Failed to fetch notes.' });
    }
});

module.exports = router;
