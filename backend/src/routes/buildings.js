const express = require('express');
const router = express.Router();
const Building = require('../models/Building');
const Room = require('../models/Room');
const CheckIn = require('../models/CheckIn');

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

module.exports = router;