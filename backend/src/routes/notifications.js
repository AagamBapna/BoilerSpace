const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Room = require('../models/Room');
const Notification = require('../models/Notification')
const { protect } = require('../middleware/auth');

router.post('/preferences', protect, async (req, res) =>  {
  try {
    const roomId = req.body.roomId;
    if (!roomId) {
      return res.status(400).json({ error: 'Room not sent' });
    }
    const room = await Room.findById(roomId)
    if (!room) {
      return res.status(404).json({ error: 'Room not found'});
    }
    const threshold = req.body.threshold;
    if (!threshold) {
      return res.status(400).json({ error: 'Threshold not sent' })
    }
    if (threshold < 1 || threshold > 100) {
      return res.status(400).json({ error: 'Threshold invalid' });
    }
    
    const user = await User.findById(req.user._id);

    const existing = user.notificationPreferences.find(
        (pref) => pref.roomId.toString() === roomId
    );

    if (existing) {
        existing.threshold = threshold;
        existing.enabled = true;
    } else {
        user.notificationPreferences.push({ roomId, threshold, enabled: true });
    }

    await user.save();
    res.status(201).json({ message: 'Notification preference saved', preferences: user.notificationPreferences });
  } catch (err) {
    if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Invalid ID provided' });
        }
        console.error('Error updating preferences:', err);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

router.get('/preferences', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('notificationPreferences.roomId');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user.notificationPreferences);
    } catch (err) {
        console.error('Error fetching notification preferences:', err);
        res.status(500).json({ error: 'Failed to fetch notification preferences' });
    }
});

router.delete('/preferences/:roomId', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        user.notificationPreferences = user.notificationPreferences.filter(
            (pref) => pref.roomId.toString() !== req.params.roomId
        );
        await user.save();
        res.json({ message: 'Preference removed', preferences: user.notificationPreferences });
    } catch (err) {
        console.error('Error deleting notification preference:', err);
        res.status(500).json({ error: 'Failed to delete notification preference' });
    }
});

router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user._id })
            .populate('roomId')
            .populate('buildingId')
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(notifications);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

router.patch('/:id/read', protect, async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        if (notification.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        notification.read = true;
        await notification.save();
        res.json({ message: 'Notification marked as read' });
    } catch (err) {
        console.error('Error updating notification:', err);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

module.exports = router;