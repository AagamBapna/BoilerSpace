const express = require('express');
const User = require('../models/User');
const Room = require('../models/Room');
const Notifications = require('../models/Notification')
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
  } catch {
    if (err.name === 'CastError') {
            return res.status(404).json({ error: 'Invalid ID provided' });
        }
        console.error('Error updating preferences:', err);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});