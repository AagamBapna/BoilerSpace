const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Building = require('../models/Building');
const Room = require('../models/Room');
const CheckIn = require('../models/CheckIn');
const User = require('../models/User');
const { signToken } = require('../config/jwt');

let mongoServer;
let building, room, user, token;

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
    await Room.deleteMany({});
    await CheckIn.deleteMany({});
    await User.deleteMany({});

    user = await User.create({
        email: 'sheehan@purdue.edu',
        password: 'password123',
        displayName: 'Sheehan',
        major: 'CS',
        year: 'Junior',
    });
    token = signToken(user);

    building = await Building.create({
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        address: '305 N University St',
        amenities: ['Wi-Fi', 'Outlets'],
    });

    room = await Room.create({
        buildingId: building._id,
        name: 'LWSN B134',
        floor: 0,
        capacity: 200,
        noiseClassification: 'Collaborative',
        amenities: ['Projector', 'Outlets'],
    });
});

// GET /api/rooms/:roomId/status

describe('GET /api/rooms/:roomId/status', () => {
    test('returns occupancy and lastStatusUpdate for a valid room', async () => {
        const res = await request(app)
            .get(`/api/rooms/${room._id}/status`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('occupancy');
        expect(res.body).toHaveProperty('lastStatusUpdate');
    });

    test('returns occupancy 0 and lastStatusUpdate null when no check-ins', async () => {
        const res = await request(app)
            .get(`/api/rooms/${room._id}/status`);

        expect(res.status).toBe(200);
        expect(res.body.occupancy).toBe(0);
        expect(res.body.lastStatusUpdate).toBeNull();
    });

    test('returns 404 for non-existent room', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/rooms/${fakeId}/status`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Room not found');
    });

    test('returns 404 for invalid room ID format', async () => {
        const res = await request(app)
            .get('/api/rooms/not-a-valid-id/status');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Room not found');
    });
});

// Check-in stamps lastStatusUpdate

describe('Check-in updates lastStatusUpdate', () => {
    test('lastStatusUpdate is set after check-in', async () => {
        const before = new Date();

        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .get(`/api/rooms/${room._id}/status`);

        expect(res.status).toBe(200);
        expect(res.body.occupancy).toBe(1);
        expect(res.body.lastStatusUpdate).not.toBeNull();

        const timestamp = new Date(res.body.lastStatusUpdate);
        const after = new Date();
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('lastStatusUpdate is within 5 seconds of check-in', async () => {
        const checkinTime = new Date();

        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .get(`/api/rooms/${room._id}/status`);

        const timestamp = new Date(res.body.lastStatusUpdate);
        const diff = Math.abs(timestamp.getTime() - checkinTime.getTime());
        expect(diff).toBeLessThan(5000);
    });

    test('lastStatusUpdate updates after checkout', async () => {
        // Check in first
        const checkinRes = await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        const checkinId = checkinRes.body._id;

        // Small delay to ensure different timestamp
        await new Promise((r) => setTimeout(r, 50));

        const beforeCheckout = new Date();

        // Check out
        await request(app)
            .delete(`/api/buildings/${building._id}/rooms/${room._id}/checkins/${checkinId}`);

        const res = await request(app)
            .get(`/api/rooms/${room._id}/status`);

        expect(res.body.occupancy).toBe(0);
        const timestamp = new Date(res.body.lastStatusUpdate);
        expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCheckout.getTime() - 100);
    });

    test('status persists after re-fetch', async () => {
        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        const res1 = await request(app)
            .get(`/api/rooms/${room._id}/status`);

        const res2 = await request(app)
            .get(`/api/rooms/${room._id}/status`);

        expect(res1.body.lastStatusUpdate).toBe(res2.body.lastStatusUpdate);
    });
});
