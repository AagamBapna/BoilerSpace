const express = require('express');
const router = express.Router();
const User = require('../models/User');

router.post('/register', async (req, res) => {
    const { email, password, displayName, major, year } = req.body;

    if (!email || !password || !displayName || !major || !year) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: 'An account with that email already exists' });
        }

        const user = await User.create({ email, password, displayName, major, year });

        res.status(201).json({
            message: 'Account created successfully',
            user: { id: user._id, email: user.email, displayName: user.displayName },
        });
    } catch (err) {
        if (err.name === 'ValidationError') {
            const message = Object.values(err.errors).map(val => val.message).join(', ');
            return res.status(400).json({ error: message });
        }
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

module.exports = router;
