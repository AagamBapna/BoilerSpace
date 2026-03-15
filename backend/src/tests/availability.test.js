const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const { signToken } = require('../config/jwt');

let mongoServer;
let user, token;

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

    user = await User.create({
        email: 'sheehan@purdue.edu',
        password: 'password123',
        displayName: 'Sheehan',
        major: 'CS',
        year: 'Junior',
    });
    token = signToken(user);
});

// GET /api/users/me/availability

describe('GET /api/users/me/availability', () => {
    test('returns empty array when no availability set', async () => {
        const res = await request(app)
            .get('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns saved availability', async () => {
        user.availability = [
            { day: 'Monday', startTime: '09:00', endTime: '12:00' },
        ];
        await user.save();

        const res = await request(app)
            .get('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].day).toBe('Monday');
        expect(res.body[0].startTime).toBe('09:00');
        expect(res.body[0].endTime).toBe('12:00');
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .get('/api/users/me/availability');

        expect(res.status).toBe(401);
    });
});

// PUT /api/users/me/availability

describe('PUT /api/users/me/availability', () => {
    test('saves valid availability and returns 200', async () => {
        const res = await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({
                availability: [
                    { day: 'Monday', startTime: '09:00', endTime: '12:00' },
                    { day: 'Wednesday', startTime: '14:00', endTime: '17:00' },
                ],
            });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Availability updated');
        expect(res.body.availability).toHaveLength(2);
    });

    test('persists availability after re-fetch', async () => {
        await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({
                availability: [
                    { day: 'Friday', startTime: '10:00', endTime: '15:00' },
                ],
            });

        const res = await request(app)
            .get('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].day).toBe('Friday');
    });

    test('clears availability with empty array', async () => {
        user.availability = [
            { day: 'Monday', startTime: '09:00', endTime: '12:00' },
        ];
        await user.save();

        const res = await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({ availability: [] });

        expect(res.status).toBe(200);
        expect(res.body.availability).toHaveLength(0);
    });

    test('rejects when startTime >= endTime (400)', async () => {
        const res = await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({
                availability: [
                    { day: 'Monday', startTime: '14:00', endTime: '09:00' },
                ],
            });

        expect(res.status).toBe(400);
        expect(res.body.details).toBeDefined();
        expect(res.body.details.some((e) => e.includes('startTime must be before endTime'))).toBe(true);
    });

    test('rejects overlapping ranges on same day (400)', async () => {
        const res = await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({
                availability: [
                    { day: 'Monday', startTime: '09:00', endTime: '12:00' },
                    { day: 'Monday', startTime: '11:00', endTime: '14:00' },
                ],
            });

        expect(res.status).toBe(400);
        expect(res.body.details).toBeDefined();
        expect(res.body.details.some((e) => e.includes('overlap'))).toBe(true);
    });

    test('rejects invalid time format (400)', async () => {
        const res = await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({
                availability: [
                    { day: 'Monday', startTime: 'morning', endTime: '12:00' },
                ],
            });

        expect(res.status).toBe(400);
        expect(res.body.details).toBeDefined();
        expect(res.body.details.some((e) => e.includes('HH:mm'))).toBe(true);
    });

    test('rejects invalid day name (400)', async () => {
        const res = await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({
                availability: [
                    { day: 'Funday', startTime: '09:00', endTime: '12:00' },
                ],
            });

        expect(res.status).toBe(400);
        expect(res.body.details).toBeDefined();
        expect(res.body.details.some((e) => e.includes('day must be one of'))).toBe(true);
    });

    test('rejects non-array availability (400)', async () => {
        const res = await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({ availability: 'not-an-array' });

        expect(res.status).toBe(400);
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .put('/api/users/me/availability')
            .send({
                availability: [
                    { day: 'Monday', startTime: '09:00', endTime: '12:00' },
                ],
            });

        expect(res.status).toBe(401);
    });

    test('allows non-overlapping ranges on same day', async () => {
        const res = await request(app)
            .put('/api/users/me/availability')
            .set('Authorization', `Bearer ${token}`)
            .send({
                availability: [
                    { day: 'Monday', startTime: '09:00', endTime: '11:00' },
                    { day: 'Monday', startTime: '13:00', endTime: '15:00' },
                ],
            });

        expect(res.status).toBe(200);
        expect(res.body.availability).toHaveLength(2);
    });
});
