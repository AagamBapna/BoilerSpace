const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const { protect } = require('../middleware/auth');

// GET /api/users/bookmarks: get current user's bookmarked rooms
router.get('/bookmarks', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate({
            path: 'bookmarks',
            populate: {
                path: 'buildingId',
                select: 'name abbreviation address',
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user.bookmarks);
    } catch (err) {
        console.error('Error fetching bookmarks:', err);
        res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
});

// POST /api/users/bookmarks/:roomId: add a room to bookmarks
router.post('/bookmarks/:roomId', protect, async (req, res) => {
    try {
        const { roomId } = req.params;

        // Verify the room exists
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        // $addToSet prevents duplicate entries
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { bookmarks: roomId },
        });

        // Return updated bookmarks 
        const user = await User.findById(req.user._id).populate({
            path: 'bookmarks',
            populate: {
                path: 'buildingId',
                select: 'name abbreviation address',
            },
        });

        res.json({ message: 'Room bookmarked', bookmarks: user.bookmarks });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid room ID' });
        }
        console.error('Error adding bookmark:', err);
        res.status(500).json({ error: 'Failed to add bookmark' });
    }
});

// DELETE /api/users/bookmarks/:roomId remove a room from bookmarks
router.delete('/bookmarks/:roomId', protect, async (req, res) => {
    try {
        const { roomId } = req.params;

        // $pull removes the entry 
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { bookmarks: roomId },
        });

        // Return updated bookmarks 
        const user = await User.findById(req.user._id).populate({
            path: 'bookmarks',
            populate: {
                path: 'buildingId',
                select: 'name abbreviation address',
            },
        });

        res.json({ message: 'Bookmark removed', bookmarks: user.bookmarks });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(400).json({ error: 'Invalid room ID' });
        }
        console.error('Error removing bookmark:', err);
        res.status(500).json({ error: 'Failed to remove bookmark' });
    }
});

module.exports = router;
