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

    // Create a test user and generate a token for auth
    user = await User.create({
        email: 'jed@purdue.edu',
        password: 'password123',
        displayName: 'Jed',
        major: 'CS',
        year: 'Sophmore',
    });
    token = signToken(user);

    // Create a test building and room
    building = await Building.create({
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42713,
        longitude: -86.9137,
        address: '496 Northwestern Ave',
        amenities: ['Wi-Fi', 'Outlets'],
    });

    room = await Room.create({
        buildingId: building._id,
        name: 'WALC 1018',
        floor: 1,
        capacity: 30,
        noiseLevel: 'moderate',
    });
});

// CheckIn Schema Validation

describe('CheckIn Schema Validation', () => {
    test('saves a valid checkin', async () => {
        const checkin = new CheckIn({
            buildingId: building._id,
            roomId: room._id,
            userId: user._id,
            expiresAt: new Date(Date.now() + 10 * 1000),
        });
        const saved = await checkin.save();
        expect(saved._id).toBeDefined();
        expect(saved.roomId.toString()).toBe(room._id.toString());
        expect(saved.userId.toString()).toBe(user._id.toString());
    });

    test('rejects a checkin missing roomId', async () => {
        const checkin = new CheckIn({
            buildingId: building._id,
            userId: user._id,
            expiresAt: new Date(Date.now() + 10 * 1000),
        });
        await expect(checkin.save()).rejects.toThrow();
    });

    test('rejects a checkin missing buildingId', async () => {
        const checkin = new CheckIn({
            roomId: room._id,
            userId: user._id,
            expiresAt: new Date(Date.now() + 10 * 1000),
        });
        await expect(checkin.save()).rejects.toThrow();
    });

    test('rejects a checkin missing userId', async () => {
        const checkin = new CheckIn({
            buildingId: building._id,
            roomId: room._id,
            expiresAt: new Date(Date.now() + 10 * 1000),
        });
        await expect(checkin.save()).rejects.toThrow();
    });

    test('rejects a checkin missing expiresAt', async () => {
        const checkin = new CheckIn({
            buildingId: building._id,
            roomId: room._id,
            userId: user._id,
        });
        await expect(checkin.save()).rejects.toThrow();
    });
});

// POST /api/buildings/:id/rooms/:roomId/checkins

describe('POST /api/buildings/:id/rooms/:roomId/checkins', () => {
    test('creates a checkin and returns 201', async () => {
        const res = await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(201);
        expect(res.body.roomId).toBe(room._id.toString());
        expect(res.body.userId).toBe(user._id.toString());
        expect(res.body.expiresAt).toBeDefined();
    });

    // Acceptance Criteria: presence recorded and contributes to occupancy
    test('increments room currentOccupancy after checkin', async () => {
        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        const updatedRoom = await Room.findById(room._id);
        expect(updatedRoom.currentOccupancy).toBe(1);
    });

    // Acceptance Criteria: prevents duplicate check-ins
    test('returns 409 if user already has an active checkin in this room', async () => {
        // First checkin
        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        // Duplicate checkin
        const res = await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(409);
        expect(res.body.error).toBe('You are already checked into this room');
    });

    test('returns 401 if no token provided', async () => {
        const res = await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`);
        expect(res.status).toBe(401);
    });

    test('returns 404 if building does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/buildings/${fakeId}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Building not found');
    });

    test('returns 404 if room does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/buildings/${building._id}/rooms/${fakeId}/checkins`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Room not found');
    });
});

// GET /api/buildings/:id/rooms/:roomId/checkins

describe('GET /api/buildings/:id/rooms/:roomId/checkins', () => {
    test('returns active checkins for a room', async () => {
        // Create an active checkin
        await CheckIn.create({
            buildingId: building._id,
            roomId: room._id,
            userId: user._id,
            expiresAt: new Date(Date.now() + 10 * 1000),
        });

        const res = await request(app)
            .get(`/api/buildings/${building._id}/rooms/${room._id}/checkins`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    // Acceptance Criteria: expired checkins not included
    test('does not return expired checkins', async () => {
        // Create an expired checkin (expiresAt in the past)
        await CheckIn.create({
            buildingId: building._id,
            roomId: room._id,
            userId: user._id,
            expiresAt: new Date(Date.now() - 10 * 1000),
        });

        const res = await request(app)
            .get(`/api/buildings/${building._id}/rooms/${room._id}/checkins`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });

    test('returns empty array when no active checkins', async () => {
        const res = await request(app)
            .get(`/api/buildings/${building._id}/rooms/${room._id}/checkins`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns 404 if building does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/buildings/${fakeId}/rooms/${room._id}/checkins`);
        expect(res.status).toBe(404);
    });

    test('returns 404 if room does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/buildings/${building._id}/rooms/${fakeId}/checkins`);
        expect(res.status).toBe(404);
    });
});

// DELETE /api/buildings/:id/rooms/:roomId/checkins/:checkinID

describe('DELETE /api/buildings/:id/rooms/:roomId/checkins/:checkinID', () => {
    let checkin;

    beforeEach(async () => {
        checkin = await CheckIn.create({
            buildingId: building._id,
            roomId: room._id,
            userId: user._id,
            expiresAt: new Date(Date.now() + 10 * 1000),
        });
        // Set occupancy to 1 to reflect the checkin
        await Room.findByIdAndUpdate(room._id, { currentOccupancy: 1 });
    });

    test('deletes a checkin and returns 204', async () => {
        const res = await request(app)
            .delete(`/api/buildings/${building._id}/rooms/${room._id}/checkins/${checkin._id}`);
        expect(res.status).toBe(204);
    });

    test('decrements room currentOccupancy after checkout', async () => {
        await request(app)
            .delete(`/api/buildings/${building._id}/rooms/${room._id}/checkins/${checkin._id}`);

        const updatedRoom = await Room.findById(room._id);
        expect(updatedRoom.currentOccupancy).toBe(0);
    });

    test('checkin no longer exists after deletion', async () => {
        await request(app)
            .delete(`/api/buildings/${building._id}/rooms/${room._id}/checkins/${checkin._id}`);

        const deleted = await CheckIn.findById(checkin._id);
        expect(deleted).toBeNull();
    });

    test('returns 404 if checkin does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/buildings/${building._id}/rooms/${room._id}/checkins/${fakeId}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Checkin not found');
    });

    test('returns 404 if building does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/buildings/${fakeId}/rooms/${room._id}/checkins/${checkin._id}`);
        expect(res.status).toBe(404);
    });
});

// Recent Buildings + Last Activity

describe('POST checkin updates recentBuildings and lastActivityAt', () => {
    test('adds building to user recentBuildings after checkin', async () => {
        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        const updatedUser = await User.findById(user._id);
        expect(updatedUser.recentBuildings).toHaveLength(1);
        expect(updatedUser.recentBuildings[0].buildingId.toString()).toBe(building._id.toString());
        expect(updatedUser.recentBuildings[0].visitedAt).toBeDefined();
    });

    test('does not duplicate building in recentBuildings on repeat checkin', async () => {
        // First checkin
        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        // Wait for checkin to expire, then checkin again
        await CheckIn.deleteMany({});
        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        const updatedUser = await User.findById(user._id);
        expect(updatedUser.recentBuildings).toHaveLength(1);
    });

    test('caps recentBuildings at 5 entries', async () => {
        // Create 6 buildings and check into each
        for (let i = 0; i < 6; i++) {
            const b = await Building.create({
                name: `Building ${i}`,
                abbreviation: `B${i}`,
                latitude: 40 + i,
                longitude: -86 + i,
            });
            const r = await Room.create({
                buildingId: b._id,
                name: `Room ${i}`,
                floor: 1,
                capacity: 10,
                noiseLevel: 'quiet',
            });
            await CheckIn.deleteMany({ userId: user._id });
            await request(app)
                .post(`/api/buildings/${b._id}/rooms/${r._id}/checkins`)
                .set('Authorization', `Bearer ${token}`);
        }

        const updatedUser = await User.findById(user._id);
        expect(updatedUser.recentBuildings.length).toBeLessThanOrEqual(5);
    });

    test('sets lastActivityAt on room after checkin', async () => {
        await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        const updatedRoom = await Room.findById(room._id);
        expect(updatedRoom.lastActivityAt).toBeDefined();
        expect(updatedRoom.lastActivityAt).toBeInstanceOf(Date);
    });

    test('sets lastActivityAt on room after checkout', async () => {
        const res = await request(app)
            .post(`/api/buildings/${building._id}/rooms/${room._id}/checkins`)
            .set('Authorization', `Bearer ${token}`);

        await request(app)
            .delete(`/api/buildings/${building._id}/rooms/${room._id}/checkins/${res.body._id}`);

        const updatedRoom = await Room.findById(room._id);
        expect(updatedRoom.lastActivityAt).toBeDefined();
    });
});