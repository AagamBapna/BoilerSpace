const nodemailer = require('nodemailer');

function toBoolean(value) {
    if (!value) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function createTransportConfig() {
    const smtpUrl = process.env.SMTP_URL;
    if (smtpUrl) {
        return smtpUrl;
    }

    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
        return {
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: toBoolean(process.env.SMTP_SECURE),
            auth:
                process.env.SMTP_USER && process.env.SMTP_PASS
                    ? {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    }
                    : undefined,
        };
    }

    return null;
}

function createResetEmailContent(resetUrl) {
    return {
        subject: 'BoilerSpace password reset',
        text: `You requested a password reset.\n\nUse this link to set a new password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
        html: `
            <p>You requested a password reset.</p>
            <p><a href="${resetUrl}">Reset your password</a></p>
            <p>If you did not request this, you can ignore this email.</p>
        `,
    };
}

function createOtpEmailContent(code) {
    return {
        subject: 'BoilerSpace email verification code',
        text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, you can ignore this email.`,
        html: `
            <p>Your verification code is:</p>
            <h2>${code}</h2>
            <p>This code expires in 15 minutes.</p>
            <p>If you did not request this, you can ignore this email.</p>
        `,
    };
}

async function sendEmail({ toEmail, content }) {
    const fromEmail = process.env.PASSWORD_RESET_FROM_EMAIL || process.env.SMTP_USER;
    const transportConfig = createTransportConfig();

    if (!transportConfig || !fromEmail) {
        return { delivered: false, mocked: true };
    }

    const transporter = nodemailer.createTransport(transportConfig);

    await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: content.subject,
        text: content.text,
        html: content.html,
    });

    return { delivered: true, mocked: false };
}

async function sendPasswordResetEmail({ toEmail, resetUrl, rawToken }) {
    const fromEmail = process.env.PASSWORD_RESET_FROM_EMAIL || process.env.SMTP_USER;
    const transportConfig = createTransportConfig();

    if (!transportConfig || !fromEmail) {
        console.log(`Password reset token for ${toEmail}: ${rawToken}`);
        console.log(`Mock reset URL: ${resetUrl}`);
        return { delivered: false, mocked: true };
    }

    const transporter = nodemailer.createTransport(transportConfig);
    const content = createResetEmailContent(resetUrl);

    await transporter.sendMail({
        from: fromEmail,
        to: toEmail,
        subject: content.subject,
        text: content.text,
        html: content.html,
    });

    return { delivered: true, mocked: false };
}

async function sendOtpEmail({ toEmail, code }) {
    const result = await sendEmail({ toEmail, content: createOtpEmailContent(code) });

    if (result.mocked) {
        console.log(`OTP for ${toEmail}: ${code}`);
    }

    return result;
}

module.exports = {
    createTransportConfig,
    createResetEmailContent,
    createOtpEmailContent,
    sendPasswordResetEmail,
    sendOtpEmail,
};
