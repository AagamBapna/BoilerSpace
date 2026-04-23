const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Room = require('../models/Room');
const { protect } = require('../middleware/auth');

// POST /api/reviews
router.post('/', protect, async (req, res) => { 
    try {
        const { rating, comment, roomId } = req.body;
        if (rating === undefined || rating === null || !comment || !roomId) {
            return res.status(400).json({ error: 'rating, comment, and roomId are required' });
        }
        const roomExists = await Room.findById(roomId);
        if (!roomExists) {
            return res.status(404).json({ error: 'Room not found' });
        }
        const newReview = await Review.create({
            rating,
            comment,
            roomId,
            userId: req.user._id,
        });
        const populatedReview = await Review.findById(newReview._id).populate('userId', 'displayName email');
        res.status(201).json(populatedReview);
    } catch (err) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ error: messages.join(', ') });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/reviews/:roomId
router.get('/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const reviews = await Review.find({ roomId })
            .populate('userId', 'displayName email')
            .sort({ createdAt: -1 });
        let averageRating = 0;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, curr) => acc + curr.rating, 0);
            averageRating = (sum / reviews.length).toFixed(1);
        }
        res.json({
            reviews,
            averageRating: parseFloat(averageRating),
            totalReviews: reviews.length,
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});
module.exports = router;
