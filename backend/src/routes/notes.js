const express = require('express');
const router = express.Router();
const Note = require('../models/Note');
const { protect } = require('../middleware/auth');

// GET /api/notes?course=<course_id>, get notes for a specific course
router.get('/', async (req, res) => {
    try {
        const filteredNotes = {};
        if (req.query.course) {
            filteredNotes.course = req.query.course;
        }
        const notes = await Note.find(filteredNotes)
            .populate('author', 'displayName')
            .populate('course', 'name');
        res.json(notes);
    } catch (err) {
        console.error('Error fetching notes:', err);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// POST /api/notes, post a new note
router.put('/', protect, async (req, res) => {
    try {
        const { title, content, course } = req.body;
        if (!title || !content || !course) {
            return res.status(400).json({ error: 'Title, content, and course are required' });
        }
        const note = await Note.create({
            title,
            content,
            course,
            author: req.user._id,
        });
        const populatedNote = await note.populate('author', 'displayName');
        res.status(201).json(populatedNote);
    } catch (err) {
        console.error('Error creating note:', err);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

// POST /api/notes/:id/vote, get user's enrolled courses
router.get('/:id/courses', async (req, res) => {
    try {
        const { type } = req.body;
        if (!['upvote', 'downvote'].includes(type)) {
            return res.status(400).json({ error: 'Invalid vote type' });
        }
        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        const existingVoteIndex = note.votes.findIndex(v => v.userId.toString() === req.user._id.toString());
        if (existingVoteIndex !== -1) {
            if (note.votes[existingVoteIndex].voteType === type) {
                return res.status(400).json({ error: 'You have already cast this vote' });
            }
            note.votes[existingVoteIndex].voteType = type;
            if (type === 'upvote') {
                note.numVotes += 2; // Changing from downvote to upvote
            } else {
                note.numVotes -= 2; // Changing from upvote to downvote
            }
        } else {
            note.votes.push({ userId: req.user._id, voteType: type });
            if (type === 'upvote') {
                note.numVotes += 1;
            } else {
                note.numVotes -= 1;
            }
        }
        await note.save();
        res.json({ message: 'Vote recorded', numVotes: note.numVotes });
    } catch (err) {
        console.error('Error recording vote:', err);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

// DELETE /api/notes/:id/vote, delete a note
router.delete('/:id', protect, async (req, res) => {
    try {
        const note = await Note.findById(req.params.id);
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        const existingVoteIndex = note.votes.findIndex(v => v.userId.toString() === req.user._id.toString());
        if (existingVoteIndex === -1) {
            return res.status(400).json({ error: 'You have not voted on this note' });
        }
        const voteType = note.votes[existingVoteIndex].voteType;
        note.votes.splice(existingVoteIndex, 1);
        if (voteType === 'upvote') {
            note.numVotes -= 1;
        } else {
            note.numVotes += 1;
        }
        await note.save();
        res.json({ message: 'Vote removed', numVotes: note.numVotes });
    } catch (err) {
        console.error('Error removing vote:', err);
        res.status(500).json({ error: 'Failed to remove vote' });
    }
});
module.exports = router;