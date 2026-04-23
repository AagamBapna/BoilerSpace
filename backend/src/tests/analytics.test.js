const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const StudySession = require('../models/StudySession');
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
    await StudySession.deleteMany({});

    user = await User.create({
        email: 'analytics@purdue.edu',
        password: 'password123',
        displayName: 'Ana Lytics',
        major: 'Data Science',
        year: 'Senior',
    });
    token = signToken(user);
});

describe('Analytics API', () => {

    describe('POST /api/analytics/session', () => {

        it('should successfully log a valid study session', async () => {
            // A 2-hour session that ended 1 minute ago. Both endpoints must be in the past
            // because future-dated sessions are rejected.
            const end = new Date(Date.now() - 60 * 1000);
            const start = new Date(end.getTime() - (120 * 60000));

            const res = await request(app)
                .post('/api/analytics/session')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    startTime: start.toISOString(),
                    endTime: end.toISOString()
                });

            expect(res.status).toBe(201);
            expect(res.body.durationMinutes).toBe(120);

            const sessionCount = await StudySession.countDocuments({ userId: user._id });
            expect(sessionCount).toBe(1);
        });

        it('should reject a session shorter than 1 minute', async () => {
            const start = new Date();
            const end = new Date(start.getTime() + (30 * 1000)); // 30 seconds

            const res = await request(app)
                .post('/api/analytics/session')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    startTime: start.toISOString(),
                    endTime: end.toISOString()
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Study session must be at least 1 minute long.');
        });

        it('should reject a session whose end time is in the future', async () => {
            const start = new Date();
            // End 30 minutes in the future, well past the 60s clock-skew tolerance
            const end = new Date(start.getTime() + (30 * 60000));

            const res = await request(app)
                .post('/api/analytics/session')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    startTime: start.toISOString(),
                    endTime: end.toISOString()
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Study sessions cannot be logged in the future.');
        });

        it('should reject a session where start is after end', async () => {
             const end = new Date();
             const start = new Date(end.getTime() + (30 * 60000)); // Future start 
 
             const res = await request(app)
                 .post('/api/analytics/session')
                 .set('Authorization', `Bearer ${token}`)
                 .send({
                     startTime: start.toISOString(),
                     endTime: end.toISOString()
                 });
 
             expect(res.status).toBe(400);
             expect(res.body.error).toBe('End time must be after start time!');
        });
    });

    describe('GET /api/analytics/weekly/:userId', () => {

        it('should accurately aggregate total weekly minutes bounded by ISO dates', async () => {
            const startOfWeek = new Date('2026-04-13T00:00:00.000Z'); // Monday
            const endOfWeek = new Date('2026-04-19T23:59:59.999Z');   // Sunday

            // Create valid session fully inside the week (120 mins)
            await StudySession.create({
                userId: user._id,
                startTime: new Date('2026-04-15T12:00:00.000Z'),
                endTime: new Date('2026-04-15T14:00:00.000Z'),
                durationMinutes: 120
            });

            // Create valid session fully inside the week (60 mins)
            await StudySession.create({
                userId: user._id,
                startTime: new Date('2026-04-17T18:00:00.000Z'),
                endTime: new Date('2026-04-17T19:00:00.000Z'),
                durationMinutes: 60
            });

            // Create session completely OUTSIDE the week boundary (Not supposed to be counted)
            await StudySession.create({
                userId: user._id,
                startTime: new Date('2026-04-06T12:00:00.000Z'), // Previous week
                endTime: new Date('2026-04-06T14:00:00.000Z'),
                durationMinutes: 120
            });

            // Fetch Aggregation
            const res = await request(app)
                .get(`/api/analytics/weekly/${user._id}`)
                .set('Authorization', `Bearer ${token}`)
                .query({
                   startDate: startOfWeek.toISOString(),
                   endDate: endOfWeek.toISOString()
                });

            expect(res.status).toBe(200);
            expect(res.body.totalWeeklyMinutes).toBe(180); // 120 + 60 (Excluded the older one)
        });

        it('should return 0 minutes if no active sessions exist in the bounded timeframe', async () => {
             const startOfWeek = new Date('2026-04-13T00:00:00.000Z'); 
             const endOfWeek = new Date('2026-04-19T23:59:59.999Z'); 
 
             const res = await request(app)
                 .get(`/api/analytics/weekly/${user._id}`)
                 .set('Authorization', `Bearer ${token}`)
                 .query({
                    startDate: startOfWeek.toISOString(),
                    endDate: endOfWeek.toISOString()
                 });
 
             expect(res.status).toBe(200);
             expect(res.body.totalWeeklyMinutes).toBe(0);
        });
    });

});
