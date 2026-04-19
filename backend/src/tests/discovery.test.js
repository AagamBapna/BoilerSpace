const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const { signToken } = require('../config/jwt');

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.disconnect();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
});

describe('GET /api/users/discovery', () => {
    let currentUser, user1, user2, privateUser, token;

    beforeEach(async () => {
        currentUser = await User.create({
            email: 'main@purdue.edu',
            password: 'password123',
            displayName: 'Main User',
            major: 'CS',
            year: 'Junior',
            profileVisibility: 'public',
            studyPreferences: { studyStyle: 'group', environment: 'collaborative' },
            interests: ['coding', 'music'],
            studyGoals: ['pass'],
        });

        token = signToken(currentUser);

        user1 = await User.create({
            email: 'user1@purdue.edu',
            password: 'password123',
            displayName: 'Perfect Match',
            major: 'CS',
            year: 'Junior',
            profileVisibility: 'public',
            studyPreferences: { studyStyle: 'group', environment: 'collaborative' },
            interests: ['coding', 'music'],
            studyGoals: ['pass'],
        });

        user2 = await User.create({
            email: 'user2@purdue.edu',
            password: 'password123',
            displayName: 'No Match',
            major: 'Math',
            year: 'Senior',
            profileVisibility: 'public',
            studyPreferences: { studyStyle: 'solo', environment: 'quiet' },
            interests: ['sports'],
            studyGoals: ['sleep'],
        });

        privateUser = await User.create({
            email: 'private@purdue.edu',
            password: 'password123',
            displayName: 'Hidden Guy',
            major: 'Art',
            year: 'Freshman',
            profileVisibility: 'private',
            studyPreferences: { studyStyle: 'group', environment: 'collaborative' },
        });
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/users/discovery');
        expect(res.status).toBe(401);
    });

    it('returns public profiles excluding self and private users, sorted by exact match score', async () => {
        const res = await request(app)
            .get('/api/users/discovery')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        // Should return user1 and user2, but not privateUser or currentUser
        expect(res.body.length).toBe(2);

        // user1 should be first because they are a perfect match based on currentUser's own profile fallback
        expect(res.body[0].email).toBe('user1@purdue.edu');
        expect(res.body[0].matchScore).toBeGreaterThan(res.body[1].matchScore);
        expect(res.body[0].matchHighlights).toContain('Study style match: group');
    });

    it('scores based on provided query url parameters override', async () => {
        const res = await request(app)
            .get('/api/users/discovery?studyStyle=solo&environment=quiet&interests=sports')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        
        // Even though currentUser is 'group', the query params target 'solo', so user2 should win
        expect(res.body[0].email).toBe('user2@purdue.edu');
        expect(res.body[0].matchScore).toBeGreaterThan(res.body[1].matchScore);
        expect(res.body[0].matchHighlights).toContain('Environment match: quiet');
    });
});
