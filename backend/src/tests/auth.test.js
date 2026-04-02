const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Otp = require('../models/Otp');
const bcrypt = require('bcrypt');
const { hashResetToken } = require('../utils/passwordReset');

let mongoServer;

const validUser = {
    email: 'test@purdue.edu',
    password: 'password123',
    displayName: 'Test User',
    major: 'Computer Science',
    year: 'Senior'
};

async function loginUser(email, password) {
    return request(app)
        .post('/api/auth/login')
        .send({ email, password });
}

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

describe('POST /api/auth/register', () => {
    test('successfully registers a new user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validUser);

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Account created successfully');
        expect(res.body.user).toHaveProperty('id');
        expect(res.body.user.email).toBe(validUser.email);
        expect(res.body.user.displayName).toBe(validUser.displayName);
    });

    test('hashes the password before storing', async () => {
        await request(app)
            .post('/api/auth/register')
            .send(validUser);

        const user = await User.findOne({ email: validUser.email }).select('+password');
        expect(user.password).not.toBe(validUser.password);

        const isMatch = await bcrypt.compare(validUser.password, user.password);
        expect(isMatch).toBe(true);
    });

    test('rejects duplicate emails', async () => {
        await User.create({ ...validUser, emailVerified: true });

        const res = await request(app)
            .post('/api/auth/register')
            .send(validUser);

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('An account with that email already exists');
    });

    test('rejects missing required fields', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'only@email.com' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('All fields are required');
    });

    test('rejects password shorter than 8 characters', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, password: 'short' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Password must be at least 8 characters');
    });

    test('rejects invalid email format', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...validUser, email: 'not-an-email' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Please provide a valid email address');
    });
});

describe('POST /api/auth/login', () => {
    test('successful login returns token and user', async () => {
        await User.create(validUser);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: validUser.password });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('token');
        expect(typeof res.body.token).toBe('string');
        expect(res.body.user).toMatchObject({
            email: validUser.email,
            displayName: validUser.displayName,
        });
        expect(res.body.user).toHaveProperty('id');
    });

    test('wrong password returns 401', async () => {
        await User.create(validUser);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid email or password');
    });

    test('non-existent email returns 401', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nonexistent@purdue.edu', password: 'password123' });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid email or password');
    });

    test('rejects missing email or password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'test@purdue.edu' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Email and password are required');
    });
});



describe('GET /api/auth/me', () => {
    test('returns user when valid token provided', async () => {
        await User.create(validUser);
        const loginRes = await loginUser(validUser.email, validUser.password);
        const token = loginRes.body.token;

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(validUser.email);
        expect(res.body.displayName).toBe(validUser.displayName);
        expect(res.body).toHaveProperty('id');
    });

    test('returns 401 when token is missing', async () => {
        const res = await request(app).get('/api/auth/me');

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });

    test('returns 401 when token is invalid', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
    });
});

describe('POST /api/auth/forgot-password', () => {
    test('returns generic message and stores reset token data for existing email', async () => {
        await User.create(validUser);

        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: validUser.email });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe(
            'If an account with that email exists, a password reset link has been sent.'
        );

        const user = await User.findOne({ email: validUser.email }).select(
            '+resetPasswordTokenHash +resetPasswordExpiresAt'
        );
        expect(user.resetPasswordTokenHash).toBeDefined();
        expect(typeof user.resetPasswordTokenHash).toBe('string');
        expect(user.resetPasswordTokenHash.length).toBeGreaterThan(0);
        expect(user.resetPasswordExpiresAt).toBeDefined();
        expect(user.resetPasswordExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('returns the same generic message for non-existent email', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({ email: 'no-user@purdue.edu' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe(
            'If an account with that email exists, a password reset link has been sent.'
        );
    });

    test('rejects missing email', async () => {
        const res = await request(app)
            .post('/api/auth/forgot-password')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Email is required');
    });
});

describe('POST /api/auth/reset-password', () => {
    test('resets password when token is valid', async () => {
        const user = await User.create(validUser);
        const rawToken = 'valid-reset-token';
        user.resetPasswordTokenHash = hashResetToken(rawToken);
        user.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: rawToken, newPassword: 'newpassword123' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Password reset successful');

        const updated = await User.findById(user._id).select(
            '+password +resetPasswordTokenHash +resetPasswordExpiresAt'
        );
        const matchesNew = await bcrypt.compare('newpassword123', updated.password);
        expect(matchesNew).toBe(true);
        expect(updated.resetPasswordTokenHash).toBeUndefined();
        expect(updated.resetPasswordExpiresAt).toBeUndefined();
    });

    test('rejects invalid token', async () => {
        await User.create(validUser);

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'invalid-token', newPassword: 'newpassword123' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid or expired reset token');
    });

    test('rejects expired token', async () => {
        const user = await User.create(validUser);
        const rawToken = 'expired-token';
        user.resetPasswordTokenHash = hashResetToken(rawToken);
        user.resetPasswordExpiresAt = new Date(Date.now() - 10 * 60 * 1000);
        await user.save();

        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: rawToken, newPassword: 'newpassword123' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid or expired reset token');
    });

    test('rejects missing token or newPassword', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'token-only' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Token and new password are required');
    });

    test('rejects too-short new password', async () => {
        const res = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: 'some-token', newPassword: 'short' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Password must be at least 8 characters');
    });

    test('old password no longer works after successful reset, new password does', async () => {
        const user = await User.create(validUser);
        const rawToken = 'login-switch-token';
        user.resetPasswordTokenHash = hashResetToken(rawToken);
        user.resetPasswordExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        const resetRes = await request(app)
            .post('/api/auth/reset-password')
            .send({ token: rawToken, newPassword: 'brandnewpass123' });
        expect(resetRes.status).toBe(200);

        const oldLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: validUser.password });
        expect(oldLoginRes.status).toBe(401);
        expect(oldLoginRes.body.error).toBe('Invalid email or password');

        const newLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: 'brandnewpass123' });
        expect(newLoginRes.status).toBe(200);
        expect(newLoginRes.body).toHaveProperty('token');
    });
});
