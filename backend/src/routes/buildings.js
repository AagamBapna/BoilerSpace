const express = require('express');
const router = express.Router();
const Building = require('../models/Building');
const Room = require('../models/Room');

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

        res.json(rooms);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Building not found' });
        }
        console.error('Error fetching rooms:', err);
        res.status(500).json({ error: 'Failed to fetch rooms' });
    }
});

module.exports = router;