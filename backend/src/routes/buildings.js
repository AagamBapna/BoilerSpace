const express = require('express');
const router = express.Router();
const Building = require('../models/Building');
const Room = require('../models/Room');
const CheckIn = require('../models/CheckIn');
const { haversineDistance } = require('../utils/distance');

// GET /api/buildings — all buildings sorted alphabetically
router.get('/', async (req, res) => {
    try {
        const buildings = await Building.find().sort({ name: 1 });
        res.json(buildings);
    } catch (err) {
        console.error('Error fetching buildings:', err);
        res.status(500).json({ error: 'Failed to fetch buildings' });
    }
});

// GET /api/buildings/nearby?lat=40.4237&lon=-86.9212
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ error: 'lat and lon query params required' });
        }
        const userLat = parseFloat(lat);
        const userLon = parseFloat(lon);
        const buildings = await Building.find();
        const sorted = buildings
            .map(b => ({
                ...b.toObject(),
                distance: haversineDistance(userLat, userLon, b.latitude, b.longitude),
            }))
            .sort((a, b) => a.distance - b.distance);
        res.json(sorted);
    } catch (err) {
        console.error('Error fetching nearby buildings:', err);
        res.status(500).json({ error: 'Failed to fetch buildings' });
    }
});

// GET /api/buildings/:id — single building
router.get('/:id', async (req, res) => {
    try {
        const building = await Building.findById(req.params.id);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }
        res.json(building);
    } catch (err) {
        // Malformed ObjectId will throw a CastError
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Building not found' });
        }
        console.error('Error fetching building:', err);
        res.status(500).json({ error: 'Failed to fetch building' });
    }
});

// GET /api/buildings/:id/rooms — all rooms for a building
router.get('/:id/rooms', async (req, res) => {
    try {
        const building = await Building.findById(req.params.id);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }
        const rooms = await Room.find({ buildingId: req.params.id })
            .sort({ floor: 1, name: 1 });
        const now = new Date();
        const roomsWithOccupancy = await Promise.all(
            rooms.map(async (room) => {
                const count = await CheckIn.countDocuments({
                    roomId: room._id,
                    expiresAt: { $gt: now },
                });
                const roomObj = room.toObject();
                roomObj.currentOccupancy = count;
                return roomObj;
            })
        );
        res.json(roomsWithOccupancy);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Building not found' });
        }
        console.error('Error fetching rooms:', err);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

// GET /api/buildings/:id/occupancy - total number of checkins for a building across all rooms
router.get('/:id/occupancy', async (req, res) => {
    try {
        const building = await Building.findById(req.params.id);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }
        const rooms = await Room.find({ buildingId: req.params.id });
        const roomIds = rooms.map(room => room._id);
        const checkIns = await CheckIn.countDocuments({ roomId: { $in: roomIds }, expiresAt: { $gt: new Date() } })
        res.json(checkIns);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Building not found' });
        }
        console.error('Error fetching rooms:', err);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

const { protect } = require('../middleware/auth');
const { aggregateSnackReports } = require('../utils/aggregateSnackReports');

// GET /api/buildings/:id/snacks — aggregated snack info + recent reports
router.get('/:id/snacks', async (req, res) => {
    try {
        const building = await Building.findById(req.params.id);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }

        const recentReports = building.snackReports
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 10)
            .map(r => ({
                type: r.type,
                value: r.value,
                createdAt: r.createdAt,
            }));

        res.json({
            cafeScore: building.cafeScore,
            vendingScore: building.vendingScore,
            cafeCount: building.cafeCount,
            vendingCount: building.vendingCount,
            lastSnackReportAt: building.lastSnackReportAt,
            recentReports,
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Building not found' });
        }
        console.error('Error fetching snack data:', err);
        res.status(500).json({ error: 'Failed to fetch snack data' });
    }
});

// POST /api/buildings/:id/snacks — submit a snack report (auth required)
router.post('/:id/snacks', protect, async (req, res) => {
    try {
        const { type, value } = req.body;

        if (!['cafe', 'vending'].includes(type)) {
            return res.status(400).json({ error: 'type must be "cafe" or "vending"' });
        }
        if (typeof value !== 'boolean') {
            return res.status(400).json({ error: 'value must be a boolean' });
        }

        const building = await Building.findById(req.params.id);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }

        // Prevent duplicate: same user + same type within 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const duplicate = building.snackReports.find(
            r => r.userId.toString() === req.user._id.toString()
                && r.type === type
                && r.createdAt > oneHourAgo
        );
        if (duplicate) {
            return res.status(409).json({ error: 'You recently reported this' });
        }

        building.snackReports.push({
            userId: req.user._id,
            type,
            value,
            createdAt: new Date(),
        });

        await aggregateSnackReports(building);

        res.json({
            cafeScore: building.cafeScore,
            vendingScore: building.vendingScore,
            cafeCount: building.cafeCount,
            vendingCount: building.vendingCount,
            lastSnackReportAt: building.lastSnackReportAt,
        });
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Building not found' });
        }
        console.error('Error submitting snack report:', err);
        res.status(500).json({ error: 'Failed to submit snack report' });
    }
});

module.exports = router;