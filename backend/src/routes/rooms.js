const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const CheckIn = require('../models/CheckIn');

// GET /api/rooms/:roomId/status 
router.get('/:roomId/status', async (req, res) => {
    try {
        const room = await Room.findById(req.params.roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const now = new Date();
        const occupancy = await CheckIn.countDocuments({
            roomId: room._id,
            expiresAt: { $gt: now },
        });

        res.json({
            occupancy,
            lastStatusUpdate: room.lastStatusUpdate || null,
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Room not found' });
        }
        console.error('Error fetching room status:', err);
        res.status(500).json({ error: 'Failed to fetch room status' });
    }
});

module.exports = router;
