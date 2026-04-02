const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Building = require('../models/Building');
const User = require('../models/User');
const { signToken } = require('../config/jwt');

let mongoServer;
let building, user, user2, token, token2;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Building.deleteMany({});
    await User.deleteMany({});

    user = await User.create({
        email: 'sheehan@purdue.edu',
        password: 'password123',
        displayName: 'Sheehan',
        major: 'CS',
        year: 'Junior',
    });
    token = signToken(user);

    user2 = await User.create({
        email: 'aagam@purdue.edu',
        password: 'password123',
        displayName: 'Aagam',
        major: 'CS',
        year: 'Senior',
    });
    token2 = signToken(user2);

    building = await Building.create({
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        address: '305 N University St',
        amenities: ['Wi-Fi', 'Outlets'],
    });
});

// GET /api/buildings/:id/snacks

describe('GET /api/buildings/:id/snacks', () => {
    test('returns default scores for building with no reports', async () => {
        const res = await request(app)
            .get(`/api/buildings/${building._id}/snacks`);

        expect(res.status).toBe(200);
        expect(res.body.cafeScore).toBe(0);
        expect(res.body.vendingScore).toBe(0);
        expect(res.body.cafeCount).toBe(0);
        expect(res.body.vendingCount).toBe(0);
        expect(res.body.lastSnackReportAt).toBeNull();
        expect(res.body.recentReports).toEqual([]);
    });

    test('returns 404 for non-existent building', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/buildings/${fakeId}/snacks`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Building not found');
    });

    test('includes report in recentReports after POST', async () => {
        await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'cafe', value: true });

        const res = await request(app)
            .get(`/api/buildings/${building._id}/snacks`);

        expect(res.status).toBe(200);
        expect(res.body.recentReports).toHaveLength(1);
        expect(res.body.recentReports[0].type).toBe('cafe');
        expect(res.body.recentReports[0].value).toBe(true);
    });
});

// POST /api/buildings/:id/snacks

describe('POST /api/buildings/:id/snacks', () => {
    test('creates report and updates aggregated scores', async () => {
        const res = await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'cafe', value: true });

        expect(res.status).toBe(200);
        expect(res.body.cafeScore).toBe(100);
        expect(res.body.cafeCount).toBe(1);
        expect(res.body.lastSnackReportAt).not.toBeNull();
    });

    test('aggregation is correct with mixed reports', async () => {
        // User 1 says cafe present
        await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'cafe', value: true });

        // User 2 says cafe not present
        await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token2}`)
            .send({ type: 'cafe', value: false });

        const res = await request(app)
            .get(`/api/buildings/${building._id}/snacks`);

        expect(res.body.cafeScore).toBe(50); // 1/2 = 50%
        expect(res.body.cafeCount).toBe(2);
    });

    test('rejects duplicate same-type report within 1 hour (409)', async () => {
        await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'vending', value: true });

        const res = await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'vending', value: false });

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('You recently reported this');
    });

    test('allows same user to report different types', async () => {
        await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'cafe', value: true });

        const res = await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'vending', value: true });

        expect(res.status).toBe(200);
        expect(res.body.vendingScore).toBe(100);
        expect(res.body.vendingCount).toBe(1);
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .send({ type: 'cafe', value: true });

        expect(res.status).toBe(401);
    });

    test('returns 400 for invalid type', async () => {
        const res = await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'pizza', value: true });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('type must be "cafe" or "vending"');
    });

    test('returns 400 for non-boolean value', async () => {
        const res = await request(app)
            .post(`/api/buildings/${building._id}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'cafe', value: 'yes' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('value must be a boolean');
    });

    test('returns 404 for non-existent building', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/buildings/${fakeId}/snacks`)
            .set('Authorization', `Bearer ${token}`)
            .send({ type: 'cafe', value: true });

        expect(res.status).toBe(404);
    });
});
