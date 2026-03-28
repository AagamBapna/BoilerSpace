const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const Friendship = require('../models/Friendship');
const { signToken } = require('../config/jwt');

let mongoServer;
let userA, userB, userC, tokenA, tokenB, tokenC;
let course1, course2;

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
    await Course.deleteMany({});
    await Friendship.deleteMany({});

    course1 = await Course.create({
        courseCode: 'CS101',
        title: 'Intro to CS',
        department: 'CS',
        semester: 'Spring 2026',
    });

    course2 = await Course.create({
        courseCode: 'MA261',
        title: 'Multivariate Calculus',
        department: 'MA',
        semester: 'Spring 2026',
    });

    // A = public, enrolled in CS101 + MA261
    userA = await User.create({
        email: 'alice@purdue.edu',
        password: 'password123',
        displayName: 'Alice',
        major: 'CS',
        year: 'Junior',
        courses: [course1._id, course2._id],
        profileVisibility: 'public',
    });

    // B = public, enrolled in CS101
    userB = await User.create({
        email: 'bob@purdue.edu',
        password: 'password123',
        displayName: 'Bob',
        major: 'CS',
        year: 'Senior',
        courses: [course1._id],
        profileVisibility: 'public',
    });

    // C = private, enrolled in CS101
    userC = await User.create({
        email: 'charlie@purdue.edu',
        password: 'password123',
        displayName: 'Charlie',
        major: 'ECE',
        year: 'Sophomore',
        courses: [course1._id],
        profileVisibility: 'private',
    });

    tokenA = signToken(userA);
    tokenB = signToken(userB);
    tokenC = signToken(userC);
});

// ── Classmate Discovery ─────────────────────────────────────

describe('GET /api/friendships/classmates', () => {
    test('returns classmates grouped by shared course', async () => {
        const res = await request(app)
            .get('/api/friendships/classmates')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        const cs101Group = res.body.find(g => g.courseCode === 'CS101');
        expect(cs101Group).toBeDefined();
        expect(cs101Group.classmates.length).toBe(1);
        expect(cs101Group.classmates[0].displayName).toBe('Bob');
    });

    test('excludes private users from discovery', async () => {
        const res = await request(app)
            .get('/api/friendships/classmates')
            .set('Authorization', `Bearer ${tokenA}`);

        const allClassmates = res.body.flatMap(g => g.classmates);
        const names = allClassmates.map(c => c.displayName);
        expect(names).not.toContain('Charlie');
    });

    test('returns empty array when user has no courses', async () => {
        const loner = await User.create({
            email: 'loner@purdue.edu',
            password: 'password123',
            displayName: 'Loner',
            major: 'PHIL',
            year: 'Freshman',
            courses: [],
        });
        const lonerToken = signToken(loner);

        const res = await request(app)
            .get('/api/friendships/classmates')
            .set('Authorization', `Bearer ${lonerToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('annotates classmates with friendship status', async () => {
        await Friendship.create({
            requester: userA._id,
            recipient: userB._id,
            status: 'pending',
        });

        const res = await request(app)
            .get('/api/friendships/classmates')
            .set('Authorization', `Bearer ${tokenA}`);

        const cs101Group = res.body.find(g => g.courseCode === 'CS101');
        const bob = cs101Group.classmates.find(c => c.displayName === 'Bob');
        expect(bob.friendship).toBeDefined();
        expect(bob.friendship.status).toBe('pending');
        expect(bob.friendship.direction).toBe('outgoing');
    });

    test('returns 401 when not authenticated', async () => {
        const res = await request(app)
            .get('/api/friendships/classmates');

        expect(res.status).toBe(401);
    });
});

// ── Send Friend Request ─────────────────────────────────────

describe('POST /api/friendships/request', () => {
    test('sends a friend request successfully', async () => {
        const res = await request(app)
            .post('/api/friendships/request')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ recipientId: userB._id.toString() });

        expect(res.status).toBe(201);
        expect(res.body.requester).toBe(userA._id.toString());
        expect(res.body.recipient).toBe(userB._id.toString());
        expect(res.body.status).toBe('pending');
    });

    test('blocks self-friending', async () => {
        const res = await request(app)
            .post('/api/friendships/request')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ recipientId: userA._id.toString() });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/yourself/i);
    });

    test('blocks duplicate friend request', async () => {
        await request(app)
            .post('/api/friendships/request')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ recipientId: userB._id.toString() });

        const res = await request(app)
            .post('/api/friendships/request')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ recipientId: userB._id.toString() });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/already exists/i);
    });

    test('blocks request to private user', async () => {
        const res = await request(app)
            .post('/api/friendships/request')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ recipientId: userC._id.toString() });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/private/i);
    });

    test('returns 401 when not authenticated', async () => {
        const res = await request(app)
            .post('/api/friendships/request')
            .send({ recipientId: userB._id.toString() });

        expect(res.status).toBe(401);
    });
});

// ── Accept / Reject ─────────────────────────────────────────

describe('PUT /api/friendships/:id/accept', () => {
    let friendship;

    beforeEach(async () => {
        friendship = await Friendship.create({
            requester: userA._id,
            recipient: userB._id,
            status: 'pending',
        });
    });

    test('recipient can accept a friend request', async () => {
        const res = await request(app)
            .put(`/api/friendships/${friendship._id}/accept`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('accepted');
    });

    test('requester cannot accept their own request', async () => {
        const res = await request(app)
            .put(`/api/friendships/${friendship._id}/accept`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(403);
    });
});

describe('PUT /api/friendships/:id/reject', () => {
    let friendship;

    beforeEach(async () => {
        friendship = await Friendship.create({
            requester: userA._id,
            recipient: userB._id,
            status: 'pending',
        });
    });

    test('recipient can reject a friend request', async () => {
        const res = await request(app)
            .put(`/api/friendships/${friendship._id}/reject`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('rejected');
    });

    test('requester cannot reject their own request', async () => {
        const res = await request(app)
            .put(`/api/friendships/${friendship._id}/reject`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(403);
    });
});

// ── Pending Lists ───────────────────────────────────────────

describe('GET /api/friendships/pending', () => {
    test('returns incoming and outgoing pending requests', async () => {
        await Friendship.create({
            requester: userA._id,
            recipient: userB._id,
            status: 'pending',
        });

        // Check from A's perspective (outgoing)
        const resA = await request(app)
            .get('/api/friendships/pending')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(resA.status).toBe(200);
        expect(resA.body.outgoing).toHaveLength(1);
        expect(resA.body.incoming).toHaveLength(0);

        // Check from B's perspective (incoming)
        const resB = await request(app)
            .get('/api/friendships/pending')
            .set('Authorization', `Bearer ${tokenB}`);

        expect(resB.status).toBe(200);
        expect(resB.body.incoming).toHaveLength(1);
        expect(resB.body.outgoing).toHaveLength(0);
        expect(resB.body.incoming[0].requester.displayName).toBe('Alice');
    });
});

// ── Friends List ────────────────────────────────────────────

describe('GET /api/friendships/friends', () => {
    test('returns accepted friends', async () => {
        await Friendship.create({
            requester: userA._id,
            recipient: userB._id,
            status: 'accepted',
        });

        const res = await request(app)
            .get('/api/friendships/friends')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].displayName).toBe('Bob');
    });

    test('does not return pending friendships', async () => {
        await Friendship.create({
            requester: userA._id,
            recipient: userB._id,
            status: 'pending',
        });

        const res = await request(app)
            .get('/api/friendships/friends')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});

// ── Unfriend / Cancel ───────────────────────────────────────

describe('DELETE /api/friendships/:id', () => {
    test('either party can delete a friendship', async () => {
        const friendship = await Friendship.create({
            requester: userA._id,
            recipient: userB._id,
            status: 'accepted',
        });

        const res = await request(app)
            .delete(`/api/friendships/${friendship._id}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/removed/i);

        // Verify it's gone
        const check = await Friendship.findById(friendship._id);
        expect(check).toBeNull();
    });

    test('third party cannot delete a friendship', async () => {
        const friendship = await Friendship.create({
            requester: userA._id,
            recipient: userB._id,
            status: 'accepted',
        });

        const res = await request(app)
            .delete(`/api/friendships/${friendship._id}`)
            .set('Authorization', `Bearer ${tokenC}`);

        expect(res.status).toBe(403);
    });
});
