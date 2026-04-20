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
        email: 'visibility@purdue.edu',
        password: 'password123',
        displayName: 'Vis Ibility',
        major: 'CS',
        year: 'Senior',
    });
    token = signToken(user);
});

describe('Visibility endpoint', () => {
    describe('defaults', () => {
        it('new users default to public profile with email=private and other fields public', async () => {
            const fresh = await User.findById(user._id);
            expect(fresh.profileVisibility).toBe('public');
            expect(fresh.fieldVisibility.email).toBe('private');
            expect(fresh.fieldVisibility.major).toBe('public');
            expect(fresh.fieldVisibility.bio).toBe('public');
            expect(fresh.fieldVisibility.weeklyStudyGoalMinutes).toBe('public');
        });
    });

    describe('GET /api/users/me/visibility', () => {
        it('returns current settings for the logged-in user', async () => {
            const res = await request(app)
                .get('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.profileVisibility).toBe('public');
            expect(res.body.fieldVisibility).toBeDefined();
            expect(res.body.fieldVisibility.email).toBe('private');
        });

        it('rejects unauthenticated requests', async () => {
            const res = await request(app).get('/api/users/me/visibility');
            expect(res.status).toBe(401);
        });
    });

    describe('PUT /api/users/me/visibility', () => {
        it('updates the master profileVisibility and persists to DB', async () => {
            const res = await request(app)
                .put('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`)
                .send({ profileVisibility: 'private' });

            expect(res.status).toBe(200);
            expect(res.body.profileVisibility).toBe('private');

            const fromDb = await User.findById(user._id);
            expect(fromDb.profileVisibility).toBe('private');
        });

        it('updates individual field visibility (partial update)', async () => {
            const res = await request(app)
                .put('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`)
                .send({ fieldVisibility: { bio: 'private' } });

            expect(res.status).toBe(200);
            expect(res.body.fieldVisibility.bio).toBe('private');
            // Other fields should be untouched
            expect(res.body.fieldVisibility.major).toBe('public');

            const fromDb = await User.findById(user._id);
            expect(fromDb.fieldVisibility.bio).toBe('private');
            expect(fromDb.fieldVisibility.major).toBe('public');
        });

        it('can update master and multiple fields in one call', async () => {
            const res = await request(app)
                .put('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    profileVisibility: 'private',
                    fieldVisibility: { bio: 'private', major: 'private' },
                });

            expect(res.status).toBe(200);
            expect(res.body.profileVisibility).toBe('private');
            expect(res.body.fieldVisibility.bio).toBe('private');
            expect(res.body.fieldVisibility.major).toBe('private');
        });

        it('rejects an empty body', async () => {
            const res = await request(app)
                .put('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`)
                .send({});
            expect(res.status).toBe(400);
        });

        it('rejects invalid profileVisibility enum', async () => {
            const res = await request(app)
                .put('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`)
                .send({ profileVisibility: 'invisible' });
            expect(res.status).toBe(400);
        });

        it('rejects invalid field visibility value', async () => {
            const res = await request(app)
                .put('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`)
                .send({ fieldVisibility: { bio: 'secret' } });
            expect(res.status).toBe(400);
        });

        it('rejects unknown / non-togglable fields', async () => {
            const res = await request(app)
                .put('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`)
                .send({ fieldVisibility: { displayName: 'private' } });
            expect(res.status).toBe(400);

            const res2 = await request(app)
                .put('/api/users/me/visibility')
                .set('Authorization', `Bearer ${token}`)
                .send({ fieldVisibility: { notARealField: 'public' } });
            expect(res2.status).toBe(400);
        });

        it('rejects unauthenticated requests', async () => {
            const res = await request(app)
                .put('/api/users/me/visibility')
                .send({ profileVisibility: 'private' });
            expect(res.status).toBe(401);
        });
    });

    describe('/api/auth/me', () => {
        it('includes profileVisibility and fieldVisibility in the response', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.profileVisibility).toBe('public');
            expect(res.body.fieldVisibility).toBeDefined();
            expect(res.body.fieldVisibility.email).toBe('private');
        });
    });
});
