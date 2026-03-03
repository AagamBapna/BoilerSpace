jest.mock('nodemailer', () => ({
    createTransport: jest.fn(),
}));

const nodemailer = require('nodemailer');
const {
    createTransportConfig,
    createResetEmailContent,
    sendPasswordResetEmail,
} = require('../utils/mailer');

describe('mailer utility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.SMTP_URL;
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_PORT;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        delete process.env.SMTP_SECURE;
        delete process.env.PASSWORD_RESET_FROM_EMAIL;
    });

    test('createTransportConfig returns SMTP_URL when provided', () => {
        process.env.SMTP_URL = 'smtp://user:pass@example.com:587';
        expect(createTransportConfig()).toBe(process.env.SMTP_URL);
    });

    test('createTransportConfig returns host config when SMTP_HOST/PORT set', () => {
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_USER = 'user@example.com';
        process.env.SMTP_PASS = 'secret';

        expect(createTransportConfig()).toEqual({
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
                user: 'user@example.com',
                pass: 'secret',
            },
        });
    });

    test('sendPasswordResetEmail logs mock reset when SMTP is not configured', async () => {
        process.env.PASSWORD_RESET_FROM_EMAIL = 'noreply@boilerspace.app';
        const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        const result = await sendPasswordResetEmail({
            toEmail: 'student@purdue.edu',
            resetUrl: 'http://localhost:5173/reset-password?token=abc',
            rawToken: 'abc',
        });

        expect(result).toEqual({ delivered: false, mocked: true });
        expect(nodemailer.createTransport).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalled();
        logSpy.mockRestore();
    });

    test('sendPasswordResetEmail uses nodemailer transport when SMTP is configured', async () => {
        process.env.SMTP_URL = 'smtp://user:pass@example.com:587';
        process.env.PASSWORD_RESET_FROM_EMAIL = 'noreply@boilerspace.app';

        const sendMail = jest.fn().mockResolvedValue({ messageId: '1' });
        nodemailer.createTransport.mockReturnValue({ sendMail });

        const result = await sendPasswordResetEmail({
            toEmail: 'student@purdue.edu',
            resetUrl: 'https://boilerspace.app/reset-password?token=abc',
            rawToken: 'abc',
        });

        expect(nodemailer.createTransport).toHaveBeenCalledWith(process.env.SMTP_URL);
        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'noreply@boilerspace.app',
                to: 'student@purdue.edu',
                subject: expect.stringContaining('password reset'),
            })
        );
        expect(result).toEqual({ delivered: true, mocked: false });
    });

    test('createResetEmailContent contains reset URL in text and html', () => {
        const resetUrl = 'https://boilerspace.app/reset-password?token=abc';
        const content = createResetEmailContent(resetUrl);

        expect(content.text).toContain(resetUrl);
        expect(content.html).toContain(resetUrl);
    });
});
