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
        email: 'goal@purdue.edu',
        password: 'password123',
        displayName: 'Goal Setter',
        major: 'CS',
        year: 'Senior',
    });
    token = signToken(user);
});

describe('Weekly Study Goal Persistence', () => {
    it('defaults to 600 minutes', async () => {
        const fresh = await User.findById(user._id);
        expect(fresh.weeklyStudyGoalMinutes).toBe(600);
    });

    it('PUT /api/users/:id with weeklyStudyGoalMinutes persists to DB', async () => {
        const res = await request(app)
            .put(`/api/users/${user._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ weeklyStudyGoalMinutes: 900 });

        expect(res.status).toBe(200);
        expect(res.body.user.weeklyStudyGoalMinutes).toBe(900);

        // Verify it actually persisted to the DB
        const fromDb = await User.findById(user._id);
        expect(fromDb.weeklyStudyGoalMinutes).toBe(900);
    });

    it('GET /api/auth/me returns the persisted goal after update', async () => {
        await request(app)
            .put(`/api/users/${user._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ weeklyStudyGoalMinutes: 1200 });

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.weeklyStudyGoalMinutes).toBe(1200);
    });

    it('rejects negative or out-of-range goals', async () => {
        const res = await request(app)
            .put(`/api/users/${user._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ weeklyStudyGoalMinutes: -10 });
        expect(res.status).toBe(400);

        const res2 = await request(app)
            .put(`/api/users/${user._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ weeklyStudyGoalMinutes: 99999 });
        expect(res2.status).toBe(400);
    });

    it('accepts a goal of 0 (no goal)', async () => {
        const res = await request(app)
            .put(`/api/users/${user._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ weeklyStudyGoalMinutes: 0 });
        expect(res.status).toBe(200);
        expect(res.body.user.weeklyStudyGoalMinutes).toBe(0);

        const fromDb = await User.findById(user._id);
        expect(fromDb.weeklyStudyGoalMinutes).toBe(0);
    });
});
