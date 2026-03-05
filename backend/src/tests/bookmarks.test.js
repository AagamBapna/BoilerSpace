const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Building = require('../models/Building');
const Room = require('../models/Room');
const User = require('../models/User');
const { signToken } = require('../config/jwt');

let mongoServer;
let building, room, room2, user, token;

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
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs'],
    });

    room = await Room.create({
        buildingId: building._id,
        name: 'LWSN B134',
        floor: 0,
        capacity: 200,
        noiseLevel: 'loud',
        amenities: ['Projector', 'Outlets'],
    });

    room2 = await Room.create({
        buildingId: building._id,
        name: 'LWSN 1106',
        floor: 1,
        capacity: 45,
        noiseLevel: 'moderate',
        amenities: ['Whiteboard', 'Outlets'],
    });
});

// POST /api/users/bookmarks/:roomId

describe('POST /api/users/bookmarks/:roomId', () => {
    test('bookmarks a room and returns 200 with updated bookmarks', async () => {
        const res = await request(app)
            .post(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Room bookmarked');
        expect(res.body.bookmarks).toHaveLength(1);
        expect(res.body.bookmarks[0]._id).toBe(room._id.toString());
    });

    test('does not create duplicate when bookmarking same room twice', async () => {
        await request(app)
            .post(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .post(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.bookmarks).toHaveLength(1);
    });

    test('can bookmark multiple different rooms', async () => {
        await request(app)
            .post(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .post(`/api/users/bookmarks/${room2._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.bookmarks).toHaveLength(2);
    });

    test('returns 404 for non-existent room', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/users/bookmarks/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Room not found');
    });

    test('returns 400 for invalid room ID format', async () => {
        const res = await request(app)
            .post('/api/users/bookmarks/not-a-valid-id')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid room ID');
    });

    test('returns 401 when no auth token provided', async () => {
        const res = await request(app)
            .post(`/api/users/bookmarks/${room._id}`);

        expect(res.status).toBe(401);
    });
});

// GET /api/users/bookmarks

describe('GET /api/users/bookmarks', () => {
    test('returns empty array when no bookmarks', async () => {
        const res = await request(app)
            .get('/api/users/bookmarks')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns bookmarked rooms with populated building data', async () => {
        await request(app)
            .post(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .get('/api/users/bookmarks')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].name).toBe('LWSN B134');
        expect(res.body[0].buildingId).toBeDefined();
        expect(res.body[0].buildingId.name).toBe('Lawson Computer Science Building');
        expect(res.body[0].buildingId.abbreviation).toBe('LWSN');
    });

    test('bookmarks persist across sessions (re-auth)', async () => {
        // Bookmark room
        await request(app)
            .post(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        // Generat new token
        const newToken = signToken(user);

        const res = await request(app)
            .get('/api/users/bookmarks')
            .set('Authorization', `Bearer ${newToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]._id).toBe(room._id.toString());
    });

    test('returns 401 when no auth token provided', async () => {
        const res = await request(app)
            .get('/api/users/bookmarks');

        expect(res.status).toBe(401);
    });
});

// DELETE /api/users/bookmarks/:roomId

describe('DELETE /api/users/bookmarks/:roomId', () => {
    beforeEach(async () => {
        await request(app)
            .post(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);
    });

    test('removes a bookmark and returns 200', async () => {
        const res = await request(app)
            .delete(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Bookmark removed');
        expect(res.body.bookmarks).toHaveLength(0);
    });

    test('room no longer appears in GET after removal', async () => {
        await request(app)
            .delete(`/api/users/bookmarks/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .get('/api/users/bookmarks')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });

    test('removing non-existent bookmark is idempotent (returns 200)', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/users/bookmarks/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        // Original bookmark intact?
        expect(res.body.bookmarks).toHaveLength(1);
    });

    test('returns 401 when no auth token provided', async () => {
        const res = await request(app)
            .delete(`/api/users/bookmarks/${room._id}`);

        expect(res.status).toBe(401);
    });
});
