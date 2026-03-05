const crypto = require('crypto');
const Otp = require('../models/Otp');

const OTP_EXPIRY_MINUTES = 15;

function generateOtpCode() {
    return crypto.randomInt(100000, 999999).toString();
}

async function createOtp(email) {
    await Otp.deleteMany({ email: email.toLowerCase() });

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    const otp = await Otp.create({
        email: email.toLowerCase(),
        code,
        expiresAt,
    });

    return otp;
}

async function verifyOtp(email, code) {
    const otp = await Otp.findOne({
        email: email.toLowerCase(),
        code,
        expiresAt: { $gt: new Date() },
        verified: false,
    });

    if (!otp) {
        return false;
    }

    otp.verified = true;
    await otp.save();

    return true;
}

module.exports = {
    generateOtpCode,
    createOtp,
    verifyOtp,
    OTP_EXPIRY_MINUTES,
};
