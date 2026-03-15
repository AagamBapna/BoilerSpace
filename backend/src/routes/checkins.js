const express = require('express');
const router = express.Router();
const Building = require('../models/Building');
const Room = require('../models/Room');
const CheckIn = require('../models/CheckIn');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// GET /api/buildings/:id/rooms/:roomId/checkins — all checkins for a room in a building
router.get('/:id/rooms/:roomId/checkins', async (req, res) => {
    try {
        const building = await Building.findById(req.params.id);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }
        const room = await Room.findById(req.params.roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        const checkins = await CheckIn.find({roomId: req.params.roomId, expiresAt: {$gt: new Date()}});
        res.json(checkins);
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Invalid ID provided' });
        }
        console.error('Error fetching checkins:', err);
        res.status(500).json({ error: 'Failed to fetch checkins' });
    }
});

// POST /api/buildings/:id/rooms/:roomId/checkins - create a checkin for a room
router.post('/:id/rooms/:roomId/checkins', protect,  async (req, res) => {
    try {
        const building = await Building.findById(req.params.id);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }
        const room = await Room.findById(req.params.roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        const checkin = await CheckIn.findOne({buildingId: req.params.id, roomId: req.params.roomId, expiresAt:{$gt: new Date()}, userId: req.user._id});
        if (!checkin) {
            const new_checkin = new CheckIn({buildingId: req.params.id, roomId: req.params.roomId, expiresAt: new Date(Date.now() + 10 * 1000) ,userId: req.user._id});
            await new_checkin.save();
            // Update recent buildings
            const user = await User.findById(req.user._id);
            user.recentBuildings = user.recentBuildings.filter(
                (entry) => entry.buildingId.toString() !== req.params.id
            );
            user.recentBuildings.unshift({
                buildingId: req.params.id,
                visitedAt: new Date(),
            });
            user.recentBuildings = user.recentBuildings.slice(0, 5);
            await user.save();
            room.currentOccupancy++;
            await room.save();
            return res.status(201).json(new_checkin);
        }
        return res.status(409).json({error: 'You are already checked into this room'});
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Invalid ID provided' });
        }
        console.error('Error fetching checkins:', err);
        res.status(500).json({ error: 'Failed to fetch checkins' });
    }
});

// DELETE /api/buildings/:id/rooms/:roomId/checkins — allow for users to checkout
router.delete('/:id/rooms/:roomId/checkins/:checkinID', async (req, res) => {
    try {
        const building = await Building.findById(req.params.id);
        if (!building) {
            return res.status(404).json({ error: 'Building not found' });
        }
        const room = await Room.findById(req.params.roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }
        const checkin = await CheckIn.findById(req.params.checkinID);
        if (!checkin) {
            return res.status(404).json({ error: 'Checkin not found' });
        }
        await checkin.deleteOne();
        room.currentOccupancy--;
        await room.save()
        res.status(204).send();
    } catch (err) {
        if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Invalid ID provided' });
        }
        console.error('Error deleting checkin:', err);
        res.status(500).json({ error: 'Failed to fetch checkins' });
    }
});

module.exports = router;

