const express = require('express');
const router = express.Router();
const { buildings, rooms } = require('../data');

// GET /api/buildings — all buildings sorted alphabetically
router.get('/', (req, res) => {
    const sorted = [...buildings].sort((a, b) => a.name.localeCompare(b.name));
    res.json(sorted);
});

// GET /api/buildings/:id — single building
router.get('/:id', (req, res) => {
    const building = buildings.find((b) => b._id === req.params.id);
    if (!building) {
        return res.status(404).json({ error: 'Building not found' });
    }
    res.json(building);
});

// GET /api/buildings/:id/rooms — rooms for a building
router.get('/:id/rooms', (req, res) => {
    const building = buildings.find((b) => b._id === req.params.id);
    if (!building) {
        return res.status(404).json({ error: 'Building not found' });
    }
    const buildingRooms = rooms
        .filter((r) => r.buildingId === req.params.id)
        .sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));
    res.json(buildingRooms);
});

module.exports = router;
