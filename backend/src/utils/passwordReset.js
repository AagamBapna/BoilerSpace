const crypto = require('crypto');

const DEFAULT_RESET_TOKEN_TTL_MINUTES = 15;

function getResetTokenTtlMinutes() {
    const parsed = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return DEFAULT_RESET_TOKEN_TTL_MINUTES;
}

function hashResetToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function generatePasswordResetToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + getResetTokenTtlMinutes() * 60 * 1000);

    return { token, tokenHash, expiresAt };
}

module.exports = {
    DEFAULT_RESET_TOKEN_TTL_MINUTES,
    getResetTokenTtlMinutes,
    hashResetToken,
    generatePasswordResetToken,
};
