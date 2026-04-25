const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const AIBookmark = require('../models/AIBookmark');
const { signToken } = require('../config/jwt');

jest.setTimeout(30000);

let mongoServer;
let userA, tokenA, userB, tokenB;

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
    await AIBookmark.deleteMany({});

    userA = await User.create({
        email: 'rohan@purdue.edu',
        password: 'password123',
        displayName: 'Rohan',
        major: 'CS',
        year: 'Junior',
    });
    tokenA = signToken(userA);

    userB = await User.create({
        email: 'someone-else@purdue.edu',
        password: 'password123',
        displayName: 'Someone Else',
        major: 'CS',
        year: 'Senior',
    });
    tokenB = signToken(userB);
});

describe('POST /api/users/bookmarks/ai', () => {
    test('creates a bookmark and returns 201 with the saved record', async () => {
        const res = await request(app)
            .post('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                promptString: 'What is a recurrence relation?',
                aiResponseText: 'A recurrence relation defines each term as a function of previous terms.',
            });

        expect(res.status).toBe(201);
        expect(res.body.promptString).toBe('What is a recurrence relation?');
        expect(res.body.aiResponseText).toContain('function of previous terms');
        expect(res.body.userId).toBe(userA._id.toString());
        expect(res.body._id).toBeDefined();
        expect(res.body.createdAt).toBeDefined();
    });

    test('persists the bookmark to the database under the requesting user', async () => {
        await request(app)
            .post('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                promptString: 'Explain P vs NP',
                aiResponseText: 'P is the class of problems solvable in polynomial time...',
            });

        const stored = await AIBookmark.find({ userId: userA._id });
        expect(stored).toHaveLength(1);
        expect(stored[0].promptString).toBe('Explain P vs NP');
    });

    test('accepts and stores an optional courseId', async () => {
        const courseId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                promptString: 'Why divide and conquer?',
                aiResponseText: 'It breaks problems into smaller subproblems...',
                courseId: courseId.toString(),
            });

        expect(res.status).toBe(201);
        expect(res.body.courseId).toBe(courseId.toString());
    });

    test('returns 400 when promptString is missing', async () => {
        const res = await request(app)
            .post('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ aiResponseText: 'answer without a question' });

        expect(res.status).toBe(400);
        expect(res.body.error.toLowerCase()).toContain('prompt');
    });

    test('returns 400 when aiResponseText is missing', async () => {
        const res = await request(app)
            .post('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ promptString: 'A question without an answer?' });

        expect(res.status).toBe(400);
        expect(res.body.error.toLowerCase()).toContain('response');
    });

    test('returns 400 when promptString is only whitespace', async () => {
        const res = await request(app)
            .post('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ promptString: '   ', aiResponseText: 'Answer.' });

        expect(res.status).toBe(400);
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request(app)
            .post('/api/users/bookmarks/ai')
            .send({ promptString: 'q', aiResponseText: 'a' });

        expect(res.status).toBe(401);
    });
});

describe('GET /api/users/bookmarks/ai', () => {
    test('returns empty array when the user has no bookmarks', async () => {
        const res = await request(app)
            .get('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns the user\'s bookmarks sorted newest-first', async () => {
        await AIBookmark.create({
            userId: userA._id,
            promptString: 'older question',
            aiResponseText: 'older answer',
            createdAt: new Date('2026-01-01T00:00:00Z'),
        });
        await AIBookmark.create({
            userId: userA._id,
            promptString: 'newer question',
            aiResponseText: 'newer answer',
            createdAt: new Date('2026-04-01T00:00:00Z'),
        });

        const res = await request(app)
            .get('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.map((b) => b.promptString)).toEqual([
            'newer question',
            'older question',
        ]);
    });

    test('excludes other users\' bookmarks', async () => {
        await AIBookmark.create({
            userId: userA._id,
            promptString: 'A\'s question',
            aiResponseText: 'A\'s answer',
        });
        await AIBookmark.create({
            userId: userB._id,
            promptString: 'B\'s question',
            aiResponseText: 'B\'s answer',
        });

        const res = await request(app)
            .get('/api/users/bookmarks/ai')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].promptString).toBe('A\'s question');
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request(app).get('/api/users/bookmarks/ai');
        expect(res.status).toBe(401);
    });
});

describe('DELETE /api/users/bookmarks/ai/:bookmarkId', () => {
    test('removes an owned bookmark and returns 204', async () => {
        const bookmark = await AIBookmark.create({
            userId: userA._id,
            promptString: 'delete me',
            aiResponseText: 'answer to delete',
        });

        const res = await request(app)
            .delete(`/api/users/bookmarks/ai/${bookmark._id}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(204);

        const stillThere = await AIBookmark.findById(bookmark._id);
        expect(stillThere).toBeNull();
    });

    test('leaves other bookmarks untouched when deleting one', async () => {
        const keep = await AIBookmark.create({
            userId: userA._id,
            promptString: 'keep me',
            aiResponseText: 'a',
        });
        const drop = await AIBookmark.create({
            userId: userA._id,
            promptString: 'drop me',
            aiResponseText: 'b',
        });

        await request(app)
            .delete(`/api/users/bookmarks/ai/${drop._id}`)
            .set('Authorization', `Bearer ${tokenA}`);

        const remaining = await AIBookmark.find({ userId: userA._id });
        expect(remaining).toHaveLength(1);
        expect(remaining[0]._id.toString()).toBe(keep._id.toString());
    });

    test('returns 404 for a non-existent bookmark id', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/users/bookmarks/ai/${fakeId}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(404);
    });

    test('returns 404 for a malformed bookmark id', async () => {
        const res = await request(app)
            .delete('/api/users/bookmarks/ai/not-a-real-id')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(404);
    });

    test('returns 403 when a user tries to delete another user\'s bookmark', async () => {
        const bookmark = await AIBookmark.create({
            userId: userB._id,
            promptString: 'B\'s private note',
            aiResponseText: 'B\'s answer',
        });

        const res = await request(app)
            .delete(`/api/users/bookmarks/ai/${bookmark._id}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(403);

        const stillThere = await AIBookmark.findById(bookmark._id);
        expect(stillThere).not.toBeNull();
    });

    test('returns 401 when unauthenticated', async () => {
        const bookmark = await AIBookmark.create({
            userId: userA._id,
            promptString: 'q',
            aiResponseText: 'a',
        });

        const res = await request(app).delete(
            `/api/users/bookmarks/ai/${bookmark._id}`
        );

        expect(res.status).toBe(401);
    });
});
