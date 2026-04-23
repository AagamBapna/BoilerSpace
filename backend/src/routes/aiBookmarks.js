const express = require('express');
const router = express.Router();
const AIBookmark = require('../models/AIBookmark');
const { protect } = require('../middleware/auth');

// GET /api/users/bookmarks/ai: list the current user's AI bookmarks, newest first
router.get('/bookmarks/ai', protect, async (req, res) => {
    try {
        const bookmarks = await AIBookmark.find({ userId: req.user._id })
            .sort({ createdAt: -1 });
        res.json(bookmarks);
    } catch (err) {
        console.error('Error fetching AI bookmarks:', err);
        res.status(500).json({ error: 'Failed to fetch AI bookmarks' });
    }
});

// POST /api/users/bookmarks/ai: save an AI Q&A response to the current user's bookmarks
router.post('/bookmarks/ai', protect, async (req, res) => {
    try {
        const { promptString, aiResponseText, courseId } = req.body;

        if (!promptString || typeof promptString !== 'string' || !promptString.trim()) {
            return res.status(400).json({ error: 'Prompt string is required' });
        }
        if (!aiResponseText || typeof aiResponseText !== 'string' || !aiResponseText.trim()) {
            return res.status(400).json({ error: 'AI response text is required' });
        }

        const bookmark = await AIBookmark.create({
            userId: req.user._id,
            promptString: promptString.trim(),
            aiResponseText,
            ...(courseId ? { courseId } : {}),
        });

        res.status(201).json(bookmark);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid courseId' });
        }
        console.error('Error creating AI bookmark:', err);
        res.status(500).json({ error: 'Failed to save AI bookmark' });
    }
});

// DELETE /api/users/bookmarks/ai/:bookmarkId: remove a single AI bookmark owned by the current user
router.delete('/bookmarks/ai/:bookmarkId', protect, async (req, res) => {
    try {
        const bookmark = await AIBookmark.findById(req.params.bookmarkId);
        if (!bookmark) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }
        if (bookmark.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        await bookmark.deleteOne();
        res.status(204).send();
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Bookmark not found' });
        }
        console.error('Error deleting AI bookmark:', err);
        res.status(500).json({ error: 'Failed to delete AI bookmark' });
    }
});

module.exports = router;
