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

describe('Notification trigger on note upload', () => {
    test('creates noteUpload notification for enrolled users', async () => {
        const Course = require('../models/Course');
        const Note = require('../models/Note');
        const { sendNotification } = require('../services/NotificationService');

        const course = await Course.create({
            courseCode: 'CS 251', department: 'CS', title: 'Data Structures', semester: 'Spring 2026',
        });

        // Enroll user in course
        user.courses = [course._id];
        await user.save();

        const uploader = await User.create({
            email: 'uploader@purdue.edu', password: 'password123',
            displayName: 'Uploader', major: 'CS', year: 'Junior',
        });

        // Simulate what notes.js does after upload
        await sendNotification({
            userId: user._id,
            type: 'noteUpload',
            message: `A new note "Lecture 5" has been uploaded for CS CS 251.`,
            courseId: course._id,
        });

        const notifications = await Notification.find({ userId: user._id });
        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe('noteUpload');
        expect(notifications[0].courseId.toString()).toBe(course._id.toString());
        expect(notifications[0].message).toContain('Lecture 5');
    });

    test('does not notify when noteUploads preference is disabled', async () => {
        const Course = require('../models/Course');
        const { sendNotification } = require('../services/NotificationService');

        const course = await Course.create({
            courseCode: 'CS 252', department: 'CS', title: 'Systems Programming', semester: 'Spring 2026',
        });

        user.notificationSettings.noteUploads = false;
        await user.save();

        const result = await sendNotification({
            userId: user._id,
            type: 'noteUpload',
            message: 'New note uploaded',
            courseId: course._id,
        });

        expect(result).toBeNull();
        const notifications = await Notification.find({ userId: user._id });
        expect(notifications).toHaveLength(0);
    });
});

describe('Notification trigger on event creation', () => {
    test('creates event notification for club members', async () => {
        const Club = require('../models/Club');
        const Event = require('../models/Event');
        const { sendNotification } = require('../services/NotificationService');

        const club = await Club.create({
            name: 'CS Club', category: 'Academic',
            organizerIds: [user._id],
        });

        const event = await Event.create({
            title: 'Hackathon', description: 'Annual hackathon',
            date: '2026-05-01', time: '10:00', location: 'WALC',
            clubId: club._id,
        });

        const member = await User.create({
            email: 'member@purdue.edu', password: 'password123',
            displayName: 'Member', major: 'CS', year: 'Sophomore',
            clubIds: [club._id.toString()],
        });

        await sendNotification({
            userId: member._id,
            type: 'event',
            message: `New event "Hackathon" created in CS Club.`,
            eventId: event._id,
        });

        const notifications = await Notification.find({ userId: member._id });
        expect(notifications).toHaveLength(1);
        expect(notifications[0].type).toBe('event');
        expect(notifications[0].eventId.toString()).toBe(event._id.toString());
    });

    test('does not notify when events preference is disabled', async () => {
        const { sendNotification } = require('../services/NotificationService');

        user.notificationSettings.events = false;
        await user.save();

        const result = await sendNotification({
            userId: user._id,
            type: 'event',
            message: 'New event created',
        });

        expect(result).toBeNull();
    });
});

describe('Notification global mute', () => {
    test('does not notify when global mute is enabled', async () => {
        const { sendNotification } = require('../services/NotificationService');

        user.notificationSettings.globalMute = true;
        await user.save();

        const result = await sendNotification({
            userId: user._id,
            type: 'noteUpload',
            message: 'Should be muted',
        });

        expect(result).toBeNull();
        const notifications = await Notification.find({ userId: user._id });
        expect(notifications).toHaveLength(0);
    });
});

describe('GET /api/notifications populates courseId and eventId', () => {
    test('populates courseId fields', async () => {
        const Course = require('../models/Course');
        const course = await Course.create({
            courseCode: 'CS 373', department: 'CS', title: 'Data Mining', semester: 'Spring 2026',
        });

        await Notification.create({
            userId: user._id,
            type: 'noteUpload',
            message: 'New note in CS 373',
            courseId: course._id,
        });

        const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body[0].courseId).toBeDefined();
        expect(res.body[0].courseId.courseCode).toBe('CS 373');
    });

    test('populates eventId fields', async () => {
        const Club = require('../models/Club');
        const Event = require('../models/Event');

        const club = await Club.create({
            name: 'Test Club', category: 'Social',
            organizerIds: [user._id],
        });
        const event = await Event.create({
            title: 'Game Night', description: 'Fun',
            date: '2026-05-15', time: '19:00', location: 'PMU',
            clubId: club._id,
        });

        await Notification.create({
            userId: user._id,
            type: 'event',
            message: 'New event: Game Night',
            eventId: event._id,
        });

        const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body[0].eventId).toBeDefined();
        expect(res.body[0].eventId.title).toBe('Game Night');
    });
});