const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const Course = require('../models/Course');
const { signToken } = require('../config/jwt');

let mongoServer;
let viewer, target, friend, course;
let viewerToken, friendToken;

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
    await Friendship.deleteMany({});
    await Course.deleteMany({});

    course = await Course.create({
        courseCode: 'CS307',
        title: 'Software Engineering',
        department: 'CS',
        semester: 'Spring 2026',
    });

    // Stranger viewer — no friendship with target.
    viewer = await User.create({
        email: 'viewer@purdue.edu',
        password: 'password123',
        displayName: 'Stranger Viewer',
        major: 'CS',
        year: 'Junior',
        courses: [course._id],
        studyPreferences: { studyStyle: 'group', environment: 'collaborative' },
        interests: ['coding'],
        studyGoals: ['Ship it'],
    });
    viewerToken = signToken(viewer);

    // Target: master-public, with a mix of fields to be privatized in tests.
    target = await User.create({
        email: 'target@purdue.edu',
        password: 'password123',
        displayName: 'Target User',
        major: 'Math',
        year: 'Senior',
        bio: 'loves math',
        courses: [course._id],
        studyPreferences: { studyStyle: 'group', environment: 'collaborative' },
        interests: ['coding', 'chess'],
        studyGoals: ['Graduate'],
        linkedResources: { github: 'targetgh' },
        weeklyStudyGoalMinutes: 420,
    });

    // Friend: shares a course with target so classmates route sees them.
    friend = await User.create({
        email: 'friend@purdue.edu',
        password: 'password123',
        displayName: 'Friendly User',
        major: 'Physics',
        year: 'Senior',
        courses: [course._id],
    });
    friendToken = signToken(friend);
    await Friendship.create({
        requester: friend._id,
        recipient: target._id,
        status: 'accepted',
    });
});

describe('Read-path visibility enforcement', () => {
    describe('GET /api/users/:id — stranger vs friend vs self', () => {
        it('stranger viewing master-public profile sees all fields when none privatized', async () => {
            const res = await request(app)
                .get(`/api/users/${target._id}`)
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.displayName).toBe('Target User');
            expect(res.body.bio).toBe('loves math');
            expect(res.body.major).toBe('Math');
            expect(res.body.interests).toEqual(expect.arrayContaining(['coding', 'chess']));
            expect(res.body.linkedResources.github).toBe('targetgh');
            expect(res.body.weeklyStudyGoalMinutes).toBe(420);
        });

        it('stranger gets privatized fields redacted; public fields pass through', async () => {
            await User.findByIdAndUpdate(target._id, {
                'fieldVisibility.bio': 'private',
                'fieldVisibility.interests': 'private',
                'fieldVisibility.linkedResources': 'private',
            });

            const res = await request(app)
                .get(`/api/users/${target._id}`)
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.displayName).toBe('Target User');
            expect(res.body.major).toBe('Math');
            expect(res.body.bio).toBeUndefined();
            expect(res.body.interests).toBeUndefined();
            expect(res.body.linkedResources).toBeUndefined();
        });

        it('friend bypasses per-field redaction and sees everything', async () => {
            await User.findByIdAndUpdate(target._id, {
                'fieldVisibility.bio': 'private',
                'fieldVisibility.interests': 'private',
                'fieldVisibility.weeklyStudyGoalMinutes': 'private',
            });

            const res = await request(app)
                .get(`/api/users/${target._id}`)
                .set('Authorization', `Bearer ${friendToken}`);

            expect(res.status).toBe(200);
            expect(res.body.connectionStatus).toBe('accepted');
            expect(res.body.bio).toBe('loves math');
            expect(res.body.interests).toEqual(expect.arrayContaining(['coding', 'chess']));
            expect(res.body.weeklyStudyGoalMinutes).toBe(420);
        });

        it('self-view returns the full user doc regardless of field flags', async () => {
            await User.findByIdAndUpdate(target._id, {
                'fieldVisibility.bio': 'private',
                'fieldVisibility.email': 'private',
            });
            const targetToken = signToken(target);

            const res = await request(app)
                .get(`/api/users/${target._id}`)
                .set('Authorization', `Bearer ${targetToken}`);

            expect(res.status).toBe(200);
            expect(res.body.bio).toBe('loves math');
            expect(res.body.email).toBe('target@purdue.edu');
        });

        it('master-private profile returns minimal payload to non-friends', async () => {
            await User.findByIdAndUpdate(target._id, { profileVisibility: 'private' });

            const res = await request(app)
                .get(`/api/users/${target._id}`)
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.displayName).toBe('Target User');
            expect(res.body.profileVisibility).toBe('private');
            expect(res.body.bio).toBeUndefined();
            expect(res.body.major).toBeUndefined();
            expect(res.body.interests).toBeUndefined();
        });

        it('legacy user with no fieldVisibility still hides email from strangers', async () => {
            await User.updateOne({ _id: target._id }, { $unset: { fieldVisibility: 1 } });

            const res = await request(app)
                .get(`/api/users/${target._id}`)
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.email).toBeUndefined();
            expect(res.body.bio).toBe('loves math');
        });
    });

    describe('GET /api/users/search — keeps private profiles but strips preview data', () => {
        it('still returns private profiles as identity-only hits', async () => {
            await User.findByIdAndUpdate(target._id, { profileVisibility: 'private' });

            const res = await request(app)
                .get('/api/users/search?q=Target')
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            const hit = res.body.find((u) => u._id === target._id.toString());
            expect(hit).toBeDefined();
            expect(hit.displayName).toBe('Target User');
            expect(hit.profileVisibility).toBe('private');
            expect(hit.email).toBeUndefined();
        });

        it('redacts email when fieldVisibility.email is private (default)', async () => {
            const res = await request(app)
                .get('/api/users/search?q=Target')
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            const hit = res.body.find((u) => u._id === target._id.toString());
            expect(hit).toBeDefined();
            expect(hit.displayName).toBe('Target User');
            expect(hit.email).toBeUndefined();
        });

        it('returns email when explicitly marked public', async () => {
            await User.findByIdAndUpdate(target._id, {
                'fieldVisibility.email': 'public',
            });

            const res = await request(app)
                .get('/api/users/search?q=Target')
                .set('Authorization', `Bearer ${viewerToken}`);

            const hit = res.body.find((u) => u._id === target._id.toString());
            expect(hit.email).toBe('target@purdue.edu');
        });
    });

    describe('GET /api/users/discovery — redacts private fields in previews', () => {
        it('excludes private profiles from results', async () => {
            await User.findByIdAndUpdate(target._id, { profileVisibility: 'private' });

            const res = await request(app)
                .get('/api/users/discovery')
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.find((u) => u._id === target._id.toString())).toBeUndefined();
        });

        it('strips private fields from the returned preview object', async () => {
            await User.findByIdAndUpdate(target._id, {
                'fieldVisibility.interests': 'private',
                'fieldVisibility.bio': 'private',
            });

            const res = await request(app)
                .get('/api/users/discovery')
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            const hit = res.body.find((u) => u._id === target._id.toString());
            expect(hit).toBeDefined();
            expect(hit.displayName).toBe('Target User');
            expect(hit.bio).toBeUndefined();
            expect(hit.interests).toBeUndefined();
            expect(hit.major).toBe('Math');
        });

        it('suppresses matchHighlights derived from private fields', async () => {
            await User.findByIdAndUpdate(target._id, {
                'fieldVisibility.interests': 'private',
            });

            const res = await request(app)
                .get('/api/users/discovery')
                .set('Authorization', `Bearer ${viewerToken}`);

            const hit = res.body.find((u) => u._id === target._id.toString());
            expect(hit).toBeDefined();
            const hasInterestHighlight = hit.matchHighlights.some((h) =>
                h.startsWith('Shared interests'),
            );
            expect(hasInterestHighlight).toBe(false);
            // Non-private match highlights are still present.
            expect(hit.matchHighlights.some((h) => h.startsWith('Study style match'))).toBe(true);
        });
    });

    describe('GET /api/friendships/classmates — keeps private classmates but strips their card', () => {
        it('includes private classmates as identity-only cards', async () => {
            await User.findByIdAndUpdate(target._id, { profileVisibility: 'private' });

            const res = await request(app)
                .get('/api/friendships/classmates')
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            const allClassmates = res.body.flatMap((g) => g.classmates);
            const hit = allClassmates.find((c) => c._id === target._id.toString());
            expect(hit).toBeDefined();
            expect(hit.displayName).toBe('Target User');
            expect(hit.profileVisibility).toBe('private');
            expect(hit.major).toBeUndefined();
            expect(hit.year).toBeUndefined();
        });

        it('omits major/year when privatized while keeping displayName', async () => {
            await User.findByIdAndUpdate(target._id, {
                'fieldVisibility.major': 'private',
                'fieldVisibility.year': 'private',
            });

            const res = await request(app)
                .get('/api/friendships/classmates')
                .set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(200);
            const allClassmates = res.body.flatMap((g) => g.classmates);
            const hit = allClassmates.find((c) => c._id === target._id.toString());
            expect(hit).toBeDefined();
            expect(hit.displayName).toBe('Target User');
            expect(hit.major).toBeUndefined();
            expect(hit.year).toBeUndefined();
        });

        it('includes major/year when left public (default)', async () => {
            const res = await request(app)
                .get('/api/friendships/classmates')
                .set('Authorization', `Bearer ${viewerToken}`);

            const allClassmates = res.body.flatMap((g) => g.classmates);
            const hit = allClassmates.find((c) => c._id === target._id.toString());
            expect(hit).toBeDefined();
            expect(hit.major).toBe('Math');
            expect(hit.year).toBe('Senior');
        });
    });
});
