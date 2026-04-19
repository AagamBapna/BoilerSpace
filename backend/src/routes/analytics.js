const express = require('express');
const router = express.Router();
const StudySession = require('../models/StudySession');
const { protect } = require('../middleware/auth');
const mongoose = require('mongoose');

// POST /api/analytics/session
// Submit a newly completed study block
router.post('/session', protect, async (req, res) => {
    try {
        const { startTime, endTime } = req.body;

        if (!startTime || !endTime) {
            return res.status(400).json({ error: 'Start and End times are highly required.' });
        }

        const start = new Date(startTime);
        const end = new Date(endTime);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date format provided.' });
        }

        if (end <= start) {
            return res.status(400).json({ error: 'End time must be after start time!' });
        }

        // Disallow sessions that end (or start) in the future to keep weekly totals honest.
        // 60s of clock-skew tolerance.
        const now = new Date();
        const skewMs = 60 * 1000;
        if (end.getTime() > now.getTime() + skewMs || start.getTime() > now.getTime() + skewMs) {
            return res.status(400).json({ error: 'Study sessions cannot be logged in the future.' });
        }

        const durationMinutes = Math.floor((end - start) / 60000);

        if (durationMinutes < 1) {
            return res.status(400).json({ error: 'Study session must be at least 1 minute long.' });
        }

        if (durationMinutes > 1440) {
            return res.status(400).json({ error: 'Session mathematically exceeds 24 hour limit.' });
        }

        const session = await StudySession.create({
            userId: req.user._id,
            startTime: start,
            endTime: end,
            durationMinutes
        });

        res.status(201).json(session);
    } catch (error) {
        console.error('Save Session Error:', error);
        res.status(500).json({ error: 'Failed to record session log.' });
    }
});

// GET /api/analytics/weekly/:userId
// Returns total study duration mapped over provided ISO timeframe bounds.
router.get('/weekly/:userId', protect, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate ISO strings are required.' });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        const userId = new mongoose.Types.ObjectId(req.params.userId);

        const result = await StudySession.aggregate([
            {
                $match: {
                    userId: userId,
                    startTime: { $gte: start },
                    endTime: { $lte: end }
                }
            },
            {
                $group: {
                    _id: null,
                    totalWeeklyMinutes: { $sum: '$durationMinutes' }
                }
            }
        ]);

        const totalMinutes = result.length > 0 ? result[0].totalWeeklyMinutes : 0;

        res.json({ totalWeeklyMinutes: totalMinutes });
    } catch (error) {
        console.error('Fetch Analytics Error:', error);
        res.status(500).json({ error: 'Failed to aggregate analytics.' });
    }
});

module.exports = router;
