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
        email: 'rohan@purdue.edu',
        password: 'password123',
        displayName: 'Rohan',
        major: 'CS',
        year: 'Junior',
    });
    token = signToken(user);
});

describe('PUT /api/users/:id/notifications/preferences', () => {
    test('updates all notification preferences and returns 200', async () => {
        const res = await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                sessionReminders: false,
                messages: false,
                events: true,
                organizationUpdates: false,
                globalMute: true,
            });

        expect(res.status).toBe(200);
        expect(res.body.notificationSettings).toEqual({
            sessionReminders: false,
            messages: false,
            events: true,
            organizationUpdates: false,
            globalMute: true,
        });
    });

    test('supports partial updates without overwriting other fields', async () => {
        // First set messages to false
        await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({ messages: false });

        // Then update only events
        const res = await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({ events: false });

        expect(res.status).toBe(200);
        expect(res.body.notificationSettings.messages).toBe(false);
        expect(res.body.notificationSettings.events).toBe(false);
        // Defaults should remain
        expect(res.body.notificationSettings.sessionReminders).toBe(true);
        expect(res.body.notificationSettings.organizationUpdates).toBe(true);
        expect(res.body.notificationSettings.globalMute).toBe(false);
    });

    test('persists preferences to the database', async () => {
        await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({ globalMute: true });

        const dbUser = await User.findById(user._id);
        expect(dbUser.notificationSettings.globalMute).toBe(true);
    });

    test('returns 401 if no token provided', async () => {
        const res = await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .send({ messages: false });

        expect(res.status).toBe(401);
    });

    test('returns 403 when updating another users preferences', async () => {
        const otherUser = await User.create({
            email: 'other@purdue.edu',
            password: 'password123',
            displayName: 'Other',
            major: 'CS',
            year: 'Senior',
        });

        const res = await request(app)
            .put(`/api/users/${otherUser._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({ messages: false });

        expect(res.status).toBe(403);
    });

    test('returns 400 for non-boolean field values', async () => {
        const res = await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({ messages: 'yes' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('must be a boolean');
    });

    test('returns 400 when no valid fields are provided', async () => {
        const res = await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({ invalidField: true });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('No valid notification preference fields');
    });

    test('returns 400 when body is empty', async () => {
        const res = await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
    });

    test('new users have default notification settings', async () => {
        const freshUser = await User.create({
            email: 'fresh@purdue.edu',
            password: 'password123',
            displayName: 'Fresh',
            major: 'CS',
            year: 'Freshman',
        });

        expect(freshUser.notificationSettings.sessionReminders).toBe(true);
        expect(freshUser.notificationSettings.messages).toBe(true);
        expect(freshUser.notificationSettings.events).toBe(true);
        expect(freshUser.notificationSettings.organizationUpdates).toBe(true);
        expect(freshUser.notificationSettings.globalMute).toBe(false);
    });

    test('GET user returns notificationSettings in response', async () => {
        await request(app)
            .put(`/api/users/${user._id}/notifications/preferences`)
            .set('Authorization', `Bearer ${token}`)
            .send({ globalMute: true, messages: false });

        const res = await request(app)
            .get(`/api/users/${user._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.notificationSettings.globalMute).toBe(true);
        expect(res.body.notificationSettings.messages).toBe(false);
    });
});
