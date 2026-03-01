const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const bcrypt = require('bcrypt');

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
        await User.create(validUser);

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
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: validUser.password });
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
