const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const User = require('../models/User');
const { signToken } = require('../config/jwt');
const { protect } = require('../middleware/auth');
const { generatePasswordResetToken, hashResetToken } = require('../utils/passwordReset');
const { sendPasswordResetEmail, sendOtpEmail } = require('../utils/mailer');
const { createOtp, verifyOtp } = require('../utils/otp');
const User_OTP = require('../models/Otp');

const GENERIC_FORGOT_PASSWORD_MESSAGE =
    'If an account with that email exists, a password reset link has been sent.';

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
            user: { id: user._id, email: user.email, displayName: user.displayName, major: user.major, year: user.year },
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
        major: req.user.major,
        year: req.user.year
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

router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const user = await User.findOne({ email: String(email).toLowerCase() }).select(
            '+resetPasswordTokenHash +resetPasswordExpiresAt'
        );

        if (user) {
            const { token, tokenHash, expiresAt } = generatePasswordResetToken();
            user.resetPasswordTokenHash = tokenHash;
            user.resetPasswordExpiresAt = expiresAt;
            await user.save();

            if (process.env.NODE_ENV !== 'test') {
                const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
                const resetUrl = `${baseUrl}/reset-password?token=${token}`;
                await sendPasswordResetEmail({
                    toEmail: user.email,
                    resetUrl,
                    rawToken: token,
                });
            }
        }

        return res.status(200).json({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
    } catch (err) {
        console.error('Forgot password error:', err.message);
        return res.status(500).json({ error: 'Failed to process forgot password request' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
        const tokenHash = hashResetToken(String(token));
        const user = await User.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpiresAt: { $gt: new Date() },
        }).select('+resetPasswordTokenHash +resetPasswordExpiresAt +password');

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        user.password = String(newPassword);
        user.resetPasswordTokenHash = undefined;
        user.resetPasswordExpiresAt = undefined;
        await user.save();

        return res.status(200).json({ message: 'Password reset successful' });
    } catch (err) {
        console.error('Reset password error:', err.message);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
});

router.post('/send-otp', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (!normalizedEmail.endsWith('@purdue.edu')) {
        return res.status(400).json({ error: 'Only @purdue.edu email addresses are allowed' });
    }

    try {
        const otp = await createOtp(normalizedEmail);

        if (process.env.NODE_ENV !== 'test') {
            await sendOtpEmail({ toEmail: normalizedEmail, code: otp.code });
        }

        res.status(200).json({ message: 'Verification code sent to your email' });
    } catch (err) {
        console.error('Send OTP error:', err.message);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

router.post('/verify-otp', async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: 'Email and code are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    try {
        const isValid = await verifyOtp(normalizedEmail, String(code));

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        await User.findOneAndUpdate(
            { email: normalizedEmail },
            { emailVerified: true }
        );

        res.status(200).json({ message: 'Email verified successfully' });
    } catch (err) {
        console.error('Verify OTP error:', err.message);
        res.status(500).json({ error: 'Failed to verify code' });
    }
});

module.exports = router;
