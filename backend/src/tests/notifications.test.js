const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Building = require('../models/Building');
const Room = require('../models/Room');
const User = require('../models/User');
const Notification = require('../models/Notification');
const CheckIn = require('../models/CheckIn');
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
    await User.deleteMany({});
    await Notification.deleteMany({});

    user = await User.create({
        email: 'jed@purdue.edu',
        password: 'password123',
        displayName: 'Jed',
        major: 'CS',
        year: 'Sophomore',
    });
    token = signToken(user);

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
        capacity: 10,
        noiseLevel: 'moderate',
    });
});

describe('POST /api/notifications/preferences', () => {
    test('saves a notification preference and returns 201', async () => {
        const res = await request(app)
            .post('/api/notifications/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId: room._id, threshold: 50 });

        expect(res.status).toBe(201);
        expect(res.body.preferences).toHaveLength(1);
        expect(res.body.preferences[0].threshold).toBe(50);
    });

    test('updates existing preference instead of duplicating', async () => {
        await request(app)
            .post('/api/notifications/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId: room._id, threshold: 50 });

        const res = await request(app)
            .post('/api/notifications/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId: room._id, threshold: 75 });

        expect(res.body.preferences).toHaveLength(1);
        expect(res.body.preferences[0].threshold).toBe(75);
    });

    test('returns 400 if roomId is missing', async () => {
        const res = await request(app)
            .post('/api/notifications/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ threshold: 50 });

        expect(res.status).toBe(400);
    });

    test('returns 400 if threshold is out of range', async () => {
        const res = await request(app)
            .post('/api/notifications/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId: room._id, threshold: 150 });

        expect(res.status).toBe(400);
    });

    test('returns 401 if no token provided', async () => {
        const res = await request(app)
            .post('/api/notifications/preferences')
            .send({ roomId: room._id, threshold: 50 });

        expect(res.status).toBe(401);
    });
});

describe('GET /api/notifications/preferences', () => {
    test('returns saved preferences for authenticated user', async () => {
        await request(app)
            .post('/api/notifications/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId: room._id, threshold: 50 });

        const res = await request(app)
            .get('/api/notifications/preferences')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });
});

describe('DELETE /api/notifications/preferences/:roomId', () => {
    test('removes a notification preference', async () => {
        await request(app)
            .post('/api/notifications/preferences')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId: room._id, threshold: 50 });

        const res = await request(app)
            .delete(`/api/notifications/preferences/${room._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.preferences).toHaveLength(0);
    });
});

describe('GET /api/notifications', () => {
    test('returns notifications for authenticated user', async () => {
        await Notification.create({
            userId: user._id,
            roomId: room._id,
            buildingId: building._id,
            message: 'WALC 1018 is under 50% capacity',
        });

        const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].message).toContain('WALC 1018');
    });

    test('does not return other users notifications', async () => {
        const otherUser = await User.create({
            email: 'other@purdue.edu',
            password: 'password123',
            displayName: 'Other',
            major: 'CS',
            year: 'Junior',
        });

        await Notification.create({
            userId: otherUser._id,
            roomId: room._id,
            buildingId: building._id,
            message: 'Not for Jed',
        });

        const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});

describe('PATCH /api/notifications/:id/read', () => {
    test('marks a notification as read', async () => {
        const notification = await Notification.create({
            userId: user._id,
            roomId: room._id,
            buildingId: building._id,
            message: 'Test notification',
        });

        const res = await request(app)
            .patch(`/api/notifications/${notification._id}/read`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        const updated = await Notification.findById(notification._id);
        expect(updated.read).toBe(true);
    });

    test('returns 403 when marking another users notification', async () => {
        const otherUser = await User.create({
            email: 'other2@purdue.edu',
            password: 'password123',
            displayName: 'Other',
            major: 'CS',
            year: 'Junior',
        });

        const notification = await Notification.create({
            userId: otherUser._id,
            roomId: room._id,
            buildingId: building._id,
            message: 'Not yours',
        });

        const res = await request(app)
            .patch(`/api/notifications/${notification._id}/read`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(403);
    });
});

describe('Notification trigger on checkout', () => {
    test('creates notification when occupancy drops below threshold', async () => {
        user.notificationPreferences.push({ roomId: room._id, threshold: 50, enabled: true });
        await user.save();

        room.currentOccupancy = 5;
        await room.save();

        const checkin = await CheckIn.create({
            buildingId: building._id,
            roomId: room._id,
            userId: user._id,
            expiresAt: new Date(Date.now() + 60000),
        });

        await request(app)
            .delete(`/api/buildings/${building._id}/rooms/${room._id}/checkins/${checkin._id}`);

        const notifications = await Notification.find({ userId: user._id });
        expect(notifications).toHaveLength(1);
        expect(notifications[0].message).toContain('WALC 1018');
    });

    test('does not create notification when already below threshold', async () => {
        user.notificationPreferences.push({ roomId: room._id, threshold: 50, enabled: true });
        await user.save();

        room.currentOccupancy = 2;
        await room.save();

        const checkin = await CheckIn.create({
            buildingId: building._id,
            roomId: room._id,
            userId: user._id,
            expiresAt: new Date(Date.now() + 60000),
        });

        await request(app)
            .delete(`/api/buildings/${building._id}/rooms/${room._id}/checkins/${checkin._id}`);

        const notifications = await Notification.find({ userId: user._id });
        expect(notifications).toHaveLength(0);
    });
});