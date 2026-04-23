const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

jest.mock('../config/socket', () => ({
    initSocket: jest.fn(),
    getIO: () => ({
        to: () => ({ emit: jest.fn() }),
        emit: jest.fn(),
    }),
    emitMessageDeleted: jest.fn(),
    emitMessageDisappeared: jest.fn(),
    emitConversationAccepted: jest.fn(),
    onlineUsers: new Map(),
}));

const app = require('../app');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Friendship = require('../models/Friendship');

jest.setTimeout(30000);

let mongoServer;

const userA = {
    email: 'alice@purdue.edu',
    password: 'password123',
    displayName: 'Alice',
    major: 'Computer Science',
    year: 'Junior',
};

const userB = {
    email: 'bob@purdue.edu',
    password: 'password123',
    displayName: 'Bob',
    major: 'Math',
    year: 'Senior',
};

const userC = {
    email: 'carol@purdue.edu',
    password: 'password123',
    displayName: 'Carol',
    major: 'Physics',
    year: 'Freshman',
};

let tokenA, tokenB, tokenC, userAId, userBId, userCId;

async function registerAndLogin(userData) {
    await request(app).post('/api/auth/register').send(userData);
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password });
    return { token: res.body.token, userId: res.body.user.id };
}

async function makeFriends(uid1, uid2) {
    await Friendship.create({
        requester: uid1,
        recipient: uid2,
        status: 'accepted',
    });
}

async function createConversation(token, participantId) {
    const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantId });
    return res.body;
}

async function sendMessage(token, convId, text) {
    const res = await request(app)
        .post(`/api/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ text });
    return res.body;
}

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Message.syncIndexes();
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Friendship.deleteMany({});

    const a = await registerAndLogin(userA);
    tokenA = a.token;
    userAId = a.userId;

    const b = await registerAndLogin(userB);
    tokenB = b.token;
    userBId = b.userId;

    const c = await registerAndLogin(userC);
    tokenC = c.token;
    userCId = c.userId;

    await makeFriends(userAId, userBId);
    await makeFriends(userAId, userCId);
});

describe('GET /api/conversations/:id/search', () => {
    let convId;

    beforeEach(async () => {
        const conv = await createConversation(tokenA, userBId);
        convId = conv._id;

        await sendMessage(tokenA, convId, 'Hey Bob how are you');
        await sendMessage(tokenB, convId, 'Doing great thanks');
        await sendMessage(tokenA, convId, 'Want to grab lunch tomorrow');
        await sendMessage(tokenB, convId, 'Sure sounds good');
        await sendMessage(tokenA, convId, 'Perfect see you at noon');
        await sendMessage(tokenB, convId, 'Lunch plans confirmed');
    });

    test('returns matches with above and below context', async () => {
        const res = await request(app)
            .get(`/api/conversations/${convId}/search?q=lunch`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.query).toBe('lunch');
        expect(Array.isArray(res.body.results)).toBe(true);
        expect(res.body.results.length).toBeGreaterThanOrEqual(2);

        const firstLunch = res.body.results.find(
            (r) => r.match.text === 'Want to grab lunch tomorrow'
        );
        expect(firstLunch).toBeDefined();
        expect(firstLunch.above?.text).toBe('Doing great thanks');
        expect(firstLunch.below?.text).toBe('Sure sounds good');
    });

    test('returns null above for the first message and null below for the last', async () => {
        await Message.deleteMany({ conversationId: convId });
        const only = await sendMessage(tokenA, convId, 'only lunch message here');
        expect(only.text).toBe('only lunch message here');

        const res = await request(app)
            .get(`/api/conversations/${convId}/search?q=lunch`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.results).toHaveLength(1);
        expect(res.body.results[0].above).toBeNull();
        expect(res.body.results[0].below).toBeNull();
    });

    test('is case insensitive', async () => {
        const res = await request(app)
            .get(`/api/conversations/${convId}/search?q=LUNCH`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.results.length).toBeGreaterThanOrEqual(2);
    });

    test('excludes deleted messages', async () => {
        const target = await Message.findOne({ text: 'Want to grab lunch tomorrow' });
        await request(app)
            .delete(`/api/conversations/${convId}/messages/${target._id}`)
            .set('Authorization', `Bearer ${tokenA}`);

        const res = await request(app)
            .get(`/api/conversations/${convId}/search?q=lunch`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        const texts = res.body.results.map((r) => r.match.text);
        expect(texts).not.toContain('Want to grab lunch tomorrow');
    });

    test('rejects non-participants', async () => {
        const res = await request(app)
            .get(`/api/conversations/${convId}/search?q=lunch`)
            .set('Authorization', `Bearer ${tokenC}`);

        expect(res.status).toBe(403);
    });

    test('returns 400 when query is empty', async () => {
        const res = await request(app)
            .get(`/api/conversations/${convId}/search?q=`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(400);
    });

    test('returns 404 for unknown conversation', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/conversations/${fakeId}/search?q=lunch`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(404);
    });

    test('returns 401 without auth', async () => {
        const res = await request(app).get(`/api/conversations/${convId}/search?q=lunch`);
        expect(res.status).toBe(401);
    });

    test('honors pagination', async () => {
        for (let i = 0; i < 25; i++) {
            await sendMessage(tokenA, convId, `extra lunch ${i}`);
        }

        const page1 = await request(app)
            .get(`/api/conversations/${convId}/search?q=lunch&limit=10&page=1`)
            .set('Authorization', `Bearer ${tokenA}`);

        const page2 = await request(app)
            .get(`/api/conversations/${convId}/search?q=lunch&limit=10&page=2`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(page1.status).toBe(200);
        expect(page2.status).toBe(200);
        expect(page1.body.results.length).toBe(10);
        expect(page2.body.results.length).toBeGreaterThan(0);
        expect(page1.body.total).toBe(page2.body.total);

        const ids1 = page1.body.results.map((r) => r.match._id);
        const ids2 = page2.body.results.map((r) => r.match._id);
        ids1.forEach((id) => expect(ids2).not.toContain(id));
    });
});

describe('GET /api/messages/search', () => {
    let convAB, convAC;

    beforeEach(async () => {
        const ab = await createConversation(tokenA, userBId);
        convAB = ab._id;
        const ac = await createConversation(tokenA, userCId);
        convAC = ac._id;

        await sendMessage(tokenA, convAB, 'pizza night sounds fun');
        await sendMessage(tokenB, convAB, 'count me in for pizza');
        await sendMessage(tokenA, convAC, 'pizza tomorrow Carol?');
        await sendMessage(tokenC, convAC, 'only if pineapple');
    });

    test('returns results grouped by conversation', async () => {
        const res = await request(app)
            .get('/api/messages/search?q=pizza')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.query).toBe('pizza');
        expect(Array.isArray(res.body.groups)).toBe(true);
        expect(res.body.groups.length).toBe(2);

        const groupIds = res.body.groups.map((g) => g.conversation._id);
        expect(groupIds).toContain(String(convAB));
        expect(groupIds).toContain(String(convAC));

        const abGroup = res.body.groups.find((g) => g.conversation._id === String(convAB));
        expect(abGroup.conversation.otherUser).toBeDefined();
        expect(abGroup.conversation.otherUser.displayName).toBe('Bob');
        expect(abGroup.matches.length).toBeGreaterThanOrEqual(2);
    });

    test('does not leak messages from conversations the user is not in', async () => {
        await makeFriends(userBId, userCId);
        const bcConv = await createConversation(tokenB, userCId);
        await sendMessage(tokenB, bcConv._id, 'pizza secret between bob and carol');

        const res = await request(app)
            .get('/api/messages/search?q=pizza')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        const allTexts = res.body.groups.flatMap((g) => g.matches.map((m) => m.text));
        expect(allTexts).not.toContain('pizza secret between bob and carol');
    });

    test('excludes deleted messages', async () => {
        const target = await Message.findOne({ text: 'pizza night sounds fun' });
        await request(app)
            .delete(`/api/conversations/${convAB}/messages/${target._id}`)
            .set('Authorization', `Bearer ${tokenA}`);

        const res = await request(app)
            .get('/api/messages/search?q=pizza')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        const allTexts = res.body.groups.flatMap((g) => g.matches.map((m) => m.text));
        expect(allTexts).not.toContain('pizza night sounds fun');
    });

    test('returns empty groups when no messages match', async () => {
        const res = await request(app)
            .get('/api/messages/search?q=xylophone')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.groups).toEqual([]);
        expect(res.body.total).toBe(0);
    });

    test('returns 400 when query is empty', async () => {
        const res = await request(app)
            .get('/api/messages/search?q=')
            .set('Authorization', `Bearer ${tokenA}`);
        expect(res.status).toBe(400);
    });

    test('returns 401 without auth', async () => {
        const res = await request(app).get('/api/messages/search?q=pizza');
        expect(res.status).toBe(401);
    });

    test('honors pagination', async () => {
        for (let i = 0; i < 15; i++) {
            await sendMessage(tokenA, convAB, `extra pizza topic ${i}`);
        }

        const page1 = await request(app)
            .get('/api/messages/search?q=pizza&limit=5&page=1')
            .set('Authorization', `Bearer ${tokenA}`);

        const page2 = await request(app)
            .get('/api/messages/search?q=pizza&limit=5&page=2')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(page1.status).toBe(200);
        expect(page2.status).toBe(200);

        const flat = (body) => body.groups.flatMap((g) => g.matches.map((m) => m._id));
        const ids1 = flat(page1.body);
        const ids2 = flat(page2.body);
        expect(ids1.length).toBe(5);
        expect(ids2.length).toBeGreaterThan(0);
        ids1.forEach((id) => expect(ids2).not.toContain(id));
        expect(page1.body.total).toBe(page2.body.total);
    });
});
