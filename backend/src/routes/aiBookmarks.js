const express = require('express');
const router = express.Router();
const AIBookmark = require('../models/AIBookmark');
const { protect } = require('../middleware/auth');

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

module.exports = router;
