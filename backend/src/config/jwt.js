require('dotenv').config();
const jwt = require('jsonwebtoken');

const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
    return jwt.sign(
        { id: user._id, email: user.email },
        secret,
        { expiresIn }
    );
}

function verifyToken(token) {
    return jwt.verify(token, secret);
}

module.exports = { signToken, verifyToken };
