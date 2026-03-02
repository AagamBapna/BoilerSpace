const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');

let mongoServer;
let testUser;
let token;

const validUser = {
    email: 'test@purdue.edu',
    password: 'password123',
    displayName: 'Test User',
    major: 'Computer Science',
    year: 'Sophomore'
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
    await request(app).post('/api/auth/register').send(validUser);
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });
    token = loginRes.body.token;
    testUser = loginRes.body.user;
});

describe('PUT /api/users/:id', () => {
    test('updates profile with valid data', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ displayName: 'New Name', major: 'Math', year: 'Senior' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Profile updated successfully');
        expect(res.body.user.displayName).toBe('New Name');
        expect(res.body.user.major).toBe('Math');
        expect(res.body.user.year).toBe('Senior');
    });

    test('rejects invalid year value', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ year: 'I am a Sophomore' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Year must be one of');
    });

    test('rejects request without auth (401)', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.id}`)
            .send({ displayName: 'InvalidUser' });

        expect(res.status).toBe(401);
    });

    test('rejects updating another users profile (403)', async () => {
        const otherUser = await User.create({
            email: 'nottest@purdue.edu',
            password: 'password123',
            displayName: 'Not Test User',
            major: 'Computer Science',
            year: 'Sophomore'
        });

        const res = await request(app)
            .put(`/api/users/${otherUser._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ displayName: 'New Name' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('You can only update your own profile');
    });

    test('rejects empty displayName', async () => {
        const res = await request(app)
            .put(`/api/users/${testUser.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ displayName: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Display name cannot be empty');
    });

    test('GET /:id confirms changes persisted', async () => {
        await request(app)
            .put(`/api/users/${testUser.id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ displayName: 'New Name', major: 'Math', year: 'Junior' });

        const res = await request(app)
            .get(`/api/users/${testUser.id}`);

        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe('New Name');
        expect(res.body.major).toBe('Math');
        expect(res.body.year).toBe('Junior');
    });
});