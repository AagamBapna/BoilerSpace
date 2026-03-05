const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Otp = require('../models/Otp');

let mongoServer;

const validUser = {
    email: 'test@purdue.edu',
    password: 'password123',
    displayName: 'Test User',
    major: 'Computer Science',
    year: 'Senior'
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    await Otp.deleteMany({});
});

describe('POST /api/auth/send-otp', () => {
    test('sends OTP for valid @purdue.edu email', async () => {
        const res = await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Verification code sent to your email');

        const otp = await Otp.findOne({ email: 'test@purdue.edu' });
        expect(otp).toBeDefined();
        expect(otp.code).toMatch(/^\d{6}$/);
        expect(otp.verified).toBe(false);
        expect(otp.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('rejects non-purdue email', async () => {
        const res = await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@gmail.com' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Only @purdue.edu email addresses are allowed');
    });

    test('rejects missing email', async () => {
        const res = await request(app)
            .post('/api/auth/send-otp')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Email is required');
    });

    test('replaces previous OTP for same email', async () => {
        await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        const firstOtp = await Otp.findOne({ email: 'test@purdue.edu' });

        await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        const otps = await Otp.find({ email: 'test@purdue.edu' });
        expect(otps).toHaveLength(1);
        expect(otps[0].code).not.toBe(firstOtp.code);
    });

    test('OTP code is 6 digits', async () => {
        await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        const otp = await Otp.findOne({ email: 'test@purdue.edu' });
        expect(otp.code.length).toBe(6);
        expect(Number(otp.code)).toBeGreaterThanOrEqual(100000);
        expect(Number(otp.code)).toBeLessThanOrEqual(999999);
    });

    test('OTP expires after 15 minutes', async () => {
        await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        const otp = await Otp.findOne({ email: 'test@purdue.edu' });
        const diff = otp.expiresAt.getTime() - otp.createdAt.getTime();
        const fifteenMinutes = 15 * 60 * 1000;
        expect(diff).toBeGreaterThanOrEqual(fifteenMinutes - 1000);
        expect(diff).toBeLessThanOrEqual(fifteenMinutes + 1000);
    });
});

describe('POST /api/auth/verify-otp', () => {
    test('successfully verifies correct OTP', async () => {
        await User.create(validUser);

        await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        const otp = await Otp.findOne({ email: 'test@purdue.edu' });

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test@purdue.edu', code: otp.code });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Email verified successfully');

        const user = await User.findOne({ email: 'test@purdue.edu' });
        expect(user.emailVerified).toBe(true);
    });

    test('rejects wrong OTP code', async () => {
        await User.create(validUser);

        await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test@purdue.edu', code: '000000' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid or expired verification code');

        const user = await User.findOne({ email: 'test@purdue.edu' });
        expect(user.emailVerified).toBe(false);
    });

    test('rejects expired OTP', async () => {
        await User.create(validUser);

        const expiredOtp = await Otp.create({
            email: 'test@purdue.edu',
            code: '123456',
            expiresAt: new Date(Date.now() - 60 * 1000),
        });

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test@purdue.edu', code: '123456' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid or expired verification code');
    });

    test('rejects already verified OTP', async () => {
        await User.create(validUser);

        await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        const otp = await Otp.findOne({ email: 'test@purdue.edu' });

        await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test@purdue.edu', code: otp.code });

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test@purdue.edu', code: otp.code });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid or expired verification code');
    });

    test('rejects missing email or code', async () => {
        const res1 = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'test@purdue.edu' });

        expect(res1.status).toBe(400);
        expect(res1.body.error).toBe('Email and code are required');

        const res2 = await request(app)
            .post('/api/auth/verify-otp')
            .send({ code: '123456' });

        expect(res2.status).toBe(400);
        expect(res2.body.error).toBe('Email and code are required');
    });

    test('rejects OTP for wrong email', async () => {
        await User.create(validUser);

        await request(app)
            .post('/api/auth/send-otp')
            .send({ email: 'test@purdue.edu' });

        const otp = await Otp.findOne({ email: 'test@purdue.edu' });

        const res = await request(app)
            .post('/api/auth/verify-otp')
            .send({ email: 'other@purdue.edu', code: otp.code });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid or expired verification code');
    });
});
