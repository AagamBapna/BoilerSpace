const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { signToken } = require('../config/jwt');
const { protect } = require('../middleware/auth');

router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = signToken(user);
        res.json({
            token,
            user: { id: user._id, email: user.email, displayName: user.displayName },
        });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

router.get('/me', protect, (req, res) => {
    res.json({
        id: req.user._id,
        email: req.user.email,
        displayName: req.user.displayName,
    });
});

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
