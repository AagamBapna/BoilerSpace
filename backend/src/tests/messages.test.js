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

let tokenA, tokenB, userAId, userBId;

async function registerAndLogin(userData) {
    await request(app).post('/api/auth/register').send(userData);
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: userData.email, password: userData.password });
    return { token: res.body.token, userId: res.body.user.id };
}

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
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Friendship.deleteMany({});

    const a = await registerAndLogin(userA);
    tokenA = a.token;
    userAId = a.userId;

    const b = await registerAndLogin(userB);
    tokenB = b.token;
    userBId = b.userId;
});

describe('POST /api/conversations', () => {
    test('creates a new conversation between two users', async () => {
        const res = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });

        expect(res.status).toBe(201);
        expect(res.body.participants).toHaveLength(2);
        const ids = res.body.participants.map(p => p._id);
        expect(ids).toContain(userAId);
        expect(ids).toContain(userBId);
    });

    test('returns existing conversation if already exists', async () => {
        const res1 = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });

        const res2 = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenB}`)
            .send({ participantId: userAId });

        expect(res1.body._id).toBe(res2.body._id);
        expect(res2.status).toBe(200);
    });

    test('cannot start conversation with yourself', async () => {
        const res = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userAId });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Cannot start a conversation with yourself');
    });

    test('returns 404 for non-existent participant', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: fakeId });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('User not found');
    });

    test('returns 400 when participantId is missing', async () => {
        const res = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('participantId is required');
    });

    test('returns 401 without auth', async () => {
        const res = await request(app)
            .post('/api/conversations')
            .send({ participantId: userBId });

        expect(res.status).toBe(401);
    });

    test('blocks starting conversation when users are blocked', async () => {
        await Friendship.create({
            requester: userAId,
            recipient: userBId,
            status: 'blocked',
        });

        const res = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Cannot start conversation due to block settings');
    });
});

describe('GET /api/conversations', () => {
    test('lists conversations sorted by most recent', async () => {
        await Friendship.create({
            requester: userAId,
            recipient: userBId,
            status: 'accepted',
        });

        const conv1 = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });

        const userC = await User.create({
            email: 'charlie@purdue.edu',
            password: 'password123',
            displayName: 'Charlie',
            major: 'Physics',
            year: 'Freshman',
        });

        await Friendship.create({
            requester: userAId,
            recipient: userC._id,
            status: 'accepted',
        });

        const conv2 = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userC._id.toString() });

        await request(app)
            .post(`/api/conversations/${conv2.body._id}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Hello Charlie' });

        const res = await request(app)
            .get('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0]._id).toBe(conv2.body._id);
        expect(res.body[1]._id).toBe(conv1.body._id);
    });

    test('includes unread count', async () => {
        await Friendship.create({
            requester: userAId,
            recipient: userBId,
            status: 'accepted',
        });

        const conv = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });

        await request(app)
            .post(`/api/conversations/${conv.body._id}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Message 1' });

        await request(app)
            .post(`/api/conversations/${conv.body._id}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Message 2' });

        const res = await request(app)
            .get('/api/conversations')
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        expect(res.body[0].unreadCount).toBe(2);
    });

    test('returns empty array when no conversations', async () => {
        const res = await request(app)
            .get('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns 401 without auth', async () => {
        const res = await request(app).get('/api/conversations');
        expect(res.status).toBe(401);
    });
});

describe('POST /api/conversations/:id/messages', () => {
    let convId;

    beforeEach(async () => {
        const conv = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });
        convId = conv.body._id;
    });

    test('sends a message successfully', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Hello Bob!' });

        expect(res.status).toBe(201);
        expect(res.body.text).toBe('Hello Bob!');
        expect(res.body.sender._id).toBe(userAId);
        expect(res.body.readBy).toContain(userAId);
    });

    test('updates lastMessage on conversation', async () => {
        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Latest message' });

        const conv = await Conversation.findById(convId);
        expect(conv.lastMessage.text).toBe('Latest message');
        expect(conv.lastMessage.sender.toString()).toBe(userAId);
    });

    test('rejects empty message', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Message text is required');
    });

    test('rejects message exceeding 2000 characters', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'x'.repeat(2001) });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Message cannot exceed 2000 characters');
    });

    test('returns 403 for non-participant', async () => {
        const userC = await User.create({
            email: 'charlie@purdue.edu',
            password: 'password123',
            displayName: 'Charlie',
            major: 'Physics',
            year: 'Freshman',
        });
        const loginC = await request(app)
            .post('/api/auth/login')
            .send({ email: userC.email, password: 'password123' });

        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${loginC.body.token}`)
            .send({ text: 'Intruder' });

        expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent conversation', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/conversations/${fakeId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Hello' });

        expect(res.status).toBe(404);
    });

    test('returns 401 without auth', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .send({ text: 'Hello' });

        expect(res.status).toBe(401);
    });

    test('stores expiresAt when sending disappearing message', async () => {
        const beforeSend = Date.now();
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                text: 'Sensitive message',
                isDisappearing: true,
                disappearingDurationSeconds: 120,
            });

        expect(res.status).toBe(201);
        expect(res.body.isDisappearing).toBe(true);
        expect(res.body.expiresAt).toBeTruthy();
        const expiresAtMs = new Date(res.body.expiresAt).getTime();
        expect(expiresAtMs).toBeGreaterThanOrEqual(beforeSend + 119000);
        expect(expiresAtMs).toBeLessThanOrEqual(beforeSend + 121000);
    });

    test('rejects disappearing message without duration', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                text: 'Sensitive message',
                isDisappearing: true,
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('disappearingDurationSeconds must be a positive integer');
    });

    test('rejects duration when message is not disappearing', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({
                text: 'Normal message',
                isDisappearing: false,
                disappearingDurationSeconds: 120,
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('disappearingDurationSeconds is only allowed for disappearing messages');
    });

    test('returns 404 when conversation contains deleted participant', async () => {
        await User.findByIdAndDelete(userBId);

        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Are you there?' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Cannot send message because a participant no longer exists');
    });

    test('returns 403 when participants are blocked', async () => {
        await Friendship.create({
            requester: userAId,
            recipient: userBId,
            status: 'blocked',
        });

        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Blocked message' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Messaging is not allowed because one user has blocked the other');
    });
});

describe('GET /api/conversations/:id/messages', () => {
    let convId;

    beforeEach(async () => {
        await Friendship.create({
            requester: userAId,
            recipient: userBId,
            status: 'accepted',
        });

        const conv = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });
        convId = conv.body._id;
    });

    test('returns messages in chronological order', async () => {
        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'First' });

        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenB}`)
            .send({ text: 'Second' });

        const res = await request(app)
            .get(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.messages).toHaveLength(2);
        expect(res.body.messages[0].text).toBe('First');
        expect(res.body.messages[1].text).toBe('Second');
        expect(res.body.page).toBe(1);
        expect(res.body.total).toBe(2);
    });

    test('paginates correctly', async () => {
        for (let i = 0; i < 5; i++) {
            await request(app)
                .post(`/api/conversations/${convId}/messages`)
                .set('Authorization', `Bearer ${tokenA}`)
                .send({ text: `Message ${i + 1}` });
        }

        const res = await request(app)
            .get(`/api/conversations/${convId}/messages?page=1&limit=2`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.messages).toHaveLength(2);
        expect(res.body.totalPages).toBe(3);
        expect(res.body.total).toBe(5);
    });

    test('returns 403 for non-participant', async () => {
        const userC = await User.create({
            email: 'charlie@purdue.edu',
            password: 'password123',
            displayName: 'Charlie',
            major: 'Physics',
            year: 'Freshman',
        });
        const loginC = await request(app)
            .post('/api/auth/login')
            .send({ email: userC.email, password: 'password123' });

        const res = await request(app)
            .get(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${loginC.body.token}`);

        expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent conversation', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/conversations/${fakeId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(404);
    });

    test('returns 401 without auth', async () => {
        const res = await request(app)
            .get(`/api/conversations/${convId}/messages`);

        expect(res.status).toBe(401);
    });
});

describe('DELETE /api/conversations/:conversationId/messages/:messageId', () => {
    let convId;
    let messageId;

    beforeEach(async () => {
        const conv = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });
        convId = conv.body._id;

        const message = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Accidental message' });
        messageId = message.body._id;
    });

    test('allows author to soft-delete a message and replace content with placeholder', async () => {
        const res = await request(app)
            .delete(`/api/conversations/${convId}/messages/${messageId}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.text).toBe('This message was deleted');
        expect(res.body.isDeleted).toBe(true);
        expect(res.body.deletedAt).toBeTruthy();
        expect(res.body.deletedBy._id).toBe(userAId);

        const stored = await Message.findById(messageId);
        expect(stored.text).toBe('This message was deleted');
        expect(stored.isDeleted).toBe(true);
        expect(stored.deletedAt).toBeTruthy();
        expect(stored.deletedBy.toString()).toBe(userAId);
    });

    test('updates conversation lastMessage when deleting the latest message', async () => {
        await request(app)
            .delete(`/api/conversations/${convId}/messages/${messageId}`)
            .set('Authorization', `Bearer ${tokenA}`);

        const conversation = await Conversation.findById(convId);
        expect(conversation.lastMessage.text).toBe('This message was deleted');
    });

    test('blocks non-author participants from deleting message', async () => {
        const res = await request(app)
            .delete(`/api/conversations/${convId}/messages/${messageId}`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Only the message author can delete this message');
    });

    test('returns 403 for non-participant', async () => {
        const userC = await User.create({
            email: 'charlie@purdue.edu',
            password: 'password123',
            displayName: 'Charlie',
            major: 'Physics',
            year: 'Freshman',
        });
        const loginC = await request(app)
            .post('/api/auth/login')
            .send({ email: userC.email, password: 'password123' });

        const res = await request(app)
            .delete(`/api/conversations/${convId}/messages/${messageId}`)
            .set('Authorization', `Bearer ${loginC.body.token}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Not a participant in this conversation');
    });

    test('returns 404 for missing conversation', async () => {
        const fakeConversationId = new mongoose.Types.ObjectId();

        const res = await request(app)
            .delete(`/api/conversations/${fakeConversationId}/messages/${messageId}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Conversation not found');
    });

    test('returns 404 for missing message', async () => {
        const fakeMessageId = new mongoose.Types.ObjectId();

        const res = await request(app)
            .delete(`/api/conversations/${convId}/messages/${fakeMessageId}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Message not found');
    });

    test('returns 400 when message is already deleted', async () => {
        await request(app)
            .delete(`/api/conversations/${convId}/messages/${messageId}`)
            .set('Authorization', `Bearer ${tokenA}`);

        const res = await request(app)
            .delete(`/api/conversations/${convId}/messages/${messageId}`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Message is already deleted');
    });

    test('returns 401 without auth', async () => {
        const res = await request(app)
            .delete(`/api/conversations/${convId}/messages/${messageId}`);

        expect(res.status).toBe(401);
    });
});

describe('PUT /api/conversations/:id/read', () => {
    let convId;

    beforeEach(async () => {
        await Friendship.create({
            requester: userAId,
            recipient: userBId,
            status: 'accepted',
        });

        const conv = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });
        convId = conv.body._id;

        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Unread 1' });

        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Unread 2' });
    });

    test('marks all messages as read', async () => {
        const res = await request(app)
            .put(`/api/conversations/${convId}/read`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Messages marked as read');

        const messages = await Message.find({ conversationId: convId });
        messages.forEach(msg => {
            expect(msg.readBy.map(id => id.toString())).toContain(userBId);
        });
    });

    test('unread count becomes 0 after marking read', async () => {
        await request(app)
            .put(`/api/conversations/${convId}/read`)
            .set('Authorization', `Bearer ${tokenB}`);

        const res = await request(app)
            .get('/api/conversations')
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.body[0].unreadCount).toBe(0);
    });

    test('returns 403 for non-participant', async () => {
        const userC = await User.create({
            email: 'charlie@purdue.edu',
            password: 'password123',
            displayName: 'Charlie',
            major: 'Physics',
            year: 'Freshman',
        });
        const loginC = await request(app)
            .post('/api/auth/login')
            .send({ email: userC.email, password: 'password123' });

        const res = await request(app)
            .put(`/api/conversations/${convId}/read`)
            .set('Authorization', `Bearer ${loginC.body.token}`);

        expect(res.status).toBe(403);
    });

    test('returns 404 for non-existent conversation', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .put(`/api/conversations/${fakeId}/read`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(404);
    });

    test('returns 401 without auth', async () => {
        const res = await request(app)
            .put(`/api/conversations/${convId}/read`);

        expect(res.status).toBe(401);
    });
});

describe('Message schema deletion and expiry metadata', () => {
    test('sets deletion and disappearing defaults', async () => {
        const conversation = await Conversation.create({
            participants: [userAId, userBId],
        });

        const message = await Message.create({
            conversationId: conversation._id,
            sender: userAId,
            text: 'Defaults check',
            readBy: [userAId],
        });

        expect(message.isDeleted).toBe(false);
        expect(message.deletedAt).toBeNull();
        expect(message.deletedBy).toBeNull();
        expect(message.isDisappearing).toBe(false);
        expect(message.expiresAt).toBeNull();
    });

    test('requires expiresAt when isDisappearing is true', async () => {
        const conversation = await Conversation.create({
            participants: [userAId, userBId],
        });

        const message = new Message({
            conversationId: conversation._id,
            sender: userAId,
            text: 'Should fail',
            readBy: [userAId],
            isDisappearing: true,
        });

        await expect(message.validate()).rejects.toThrow('expiresAt must be set only for disappearing messages');
    });

    test('rejects expiresAt when isDisappearing is false', async () => {
        const conversation = await Conversation.create({
            participants: [userAId, userBId],
        });

        const message = new Message({
            conversationId: conversation._id,
            sender: userAId,
            text: 'Should fail',
            readBy: [userAId],
            isDisappearing: false,
            expiresAt: new Date(Date.now() + 60000),
        });

        await expect(message.validate()).rejects.toThrow('expiresAt must be set only for disappearing messages');
    });

    test('requires deletedAt and deletedBy when isDeleted is true', async () => {
        const conversation = await Conversation.create({
            participants: [userAId, userBId],
        });

        const missingDeletedAt = new Message({
            conversationId: conversation._id,
            sender: userAId,
            text: 'Should fail',
            readBy: [userAId],
            isDeleted: true,
            deletedBy: userAId,
        });

        await expect(missingDeletedAt.validate()).rejects.toThrow('deletedAt must be set only for deleted messages');

        const missingDeletedBy = new Message({
            conversationId: conversation._id,
            sender: userAId,
            text: 'Should fail',
            readBy: [userAId],
            isDeleted: true,
            deletedAt: new Date(),
        });

        await expect(missingDeletedBy.validate()).rejects.toThrow('deletedBy must be set only for deleted messages');
    });

    test('accepts valid disappearing and deleted metadata combinations', async () => {
        const conversation = await Conversation.create({
            participants: [userAId, userBId],
        });

        const disappearingMessage = new Message({
            conversationId: conversation._id,
            sender: userAId,
            text: 'Will disappear',
            readBy: [userAId],
            isDisappearing: true,
            expiresAt: new Date(Date.now() + 60000),
        });

        await expect(disappearingMessage.validate()).resolves.toBeUndefined();

        const deletedMessage = new Message({
            conversationId: conversation._id,
            sender: userAId,
            text: 'Deleted marker',
            readBy: [userAId],
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: userAId,
        });

        await expect(deletedMessage.validate()).resolves.toBeUndefined();
    });
});

describe('readAt field behavior', () => {
    let convId;

    beforeEach(async () => {
        const conv = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });
        convId = conv.body._id;
    });

    test('readAt is null on fresh messages', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Fresh message' });

        expect(res.status).toBe(201);
        const msg = await Message.findById(res.body._id);
        expect(msg.readAt).toBeNull();
    });

    test('PUT /:id/read sets readAt timestamp on messages from other user', async () => {
        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Message from A' });

        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Another from A' });

        const beforeRead = new Date();

        await request(app)
            .put(`/api/conversations/${convId}/read`)
            .set('Authorization', `Bearer ${tokenB}`);

        const messages = await Message.find({ conversationId: convId });
        messages.forEach(msg => {
            expect(msg.readAt).not.toBeNull();
            expect(new Date(msg.readAt).getTime()).toBeGreaterThanOrEqual(beforeRead.getTime() - 1000);
        });
    });

    test('readAt is not overwritten on second mark-read call', async () => {
        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Will be read twice' });

        await request(app)
            .put(`/api/conversations/${convId}/read`)
            .set('Authorization', `Bearer ${tokenB}`);

        const firstRead = await Message.findOne({ conversationId: convId, text: 'Will be read twice' });
        const firstReadAt = firstRead.readAt;

        await new Promise(resolve => setTimeout(resolve, 50));

        await request(app)
            .put(`/api/conversations/${convId}/read`)
            .set('Authorization', `Bearer ${tokenB}`);

        const secondRead = await Message.findOne({ conversationId: convId, text: 'Will be read twice' });
        expect(secondRead.readAt.getTime()).toBe(firstReadAt.getTime());
    });

    test('readAt stays null for messages sent by the reader', async () => {
        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'My own message' });

        await request(app)
            .put(`/api/conversations/${convId}/read`)
            .set('Authorization', `Bearer ${tokenA}`);

        const msg = await Message.findOne({ conversationId: convId, text: 'My own message' });
        expect(msg.readAt).toBeNull();
    });

    test('GET messages returns readAt field', async () => {
        await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Check readAt in response' });

        await request(app)
            .put(`/api/conversations/${convId}/read`)
            .set('Authorization', `Bearer ${tokenB}`);

        const res = await request(app)
            .get(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.messages[0].readAt).toBeTruthy();
    });

    test('readAt defaults to null in schema', async () => {
        const conversation = await Conversation.create({
            participants: [userAId, userBId],
        });

        const message = await Message.create({
            conversationId: conversation._id,
            sender: userAId,
            text: 'Schema default check',
            readBy: [userAId],
        });

        expect(message.readAt).toBeNull();
    });
});

describe('Conversation request status', () => {
    test('conversation between friends is created with status accepted', async () => {
        await Friendship.create({
            requester: userAId,
            recipient: userBId,
            status: 'accepted',
        });

        const res = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('accepted');
        expect(res.body.initiator).toBeNull();
    });

    test('conversation between non-friends is created with status pending', async () => {
        const res = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('pending');
        expect(res.body.initiator).toBe(userAId);
    });

    test('rejected conversation blocks new conversation creation', async () => {
        const conv = await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'rejected',
            initiator: userAId,
        });

        const res = await request(app)
            .post('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ participantId: userBId });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('previously rejected');
    });

    test('GET / only returns accepted conversations', async () => {
        await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'pending',
            initiator: userAId,
        });

        await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'accepted',
        });

        const res = await request(app)
            .get('/api/conversations')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        res.body.forEach(conv => {
            expect(conv.status).toBe('accepted');
        });
    });
});

describe('POST /api/conversations/:id/accept', () => {
    let convId;

    beforeEach(async () => {
        const conv = await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'pending',
            initiator: userAId,
        });
        convId = conv._id.toString();
    });

    test('recipient can accept a pending request', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/accept`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('accepted');
    });

    test('initiator cannot accept their own request', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/accept`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('Only the recipient');
    });

    test('returns 400 for already accepted conversation', async () => {
        await Conversation.findByIdAndUpdate(convId, { status: 'accepted' });

        const res = await request(app)
            .post(`/api/conversations/${convId}/accept`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(400);
    });

    test('returns 404 for non-existent conversation', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/conversations/${fakeId}/accept`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(404);
    });
});

describe('POST /api/conversations/:id/reject', () => {
    let convId;

    beforeEach(async () => {
        const conv = await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'pending',
            initiator: userAId,
        });
        convId = conv._id.toString();
    });

    test('recipient can reject a pending request', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/reject`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('rejected');
    });

    test('initiator cannot reject their own request', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/reject`)
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(403);
    });

    test('returns 400 for already rejected conversation', async () => {
        await Conversation.findByIdAndUpdate(convId, { status: 'rejected' });

        const res = await request(app)
            .post(`/api/conversations/${convId}/reject`)
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(400);
    });
});

describe('GET /api/conversations/requests', () => {
    test('returns only pending conversations where user is recipient', async () => {
        await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'pending',
            initiator: userAId,
        });

        const res = await request(app)
            .get('/api/conversations/requests')
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        expect(res.body[0].status).toBe('pending');
    });

    test('does not return requests the user initiated', async () => {
        await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'pending',
            initiator: userAId,
        });

        const res = await request(app)
            .get('/api/conversations/requests')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(0);
    });

    test('returns empty array when no pending requests', async () => {
        const res = await request(app)
            .get('/api/conversations/requests')
            .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(0);
    });

    test('includes message preview', async () => {
        const conv = await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'pending',
            initiator: userAId,
        });

        await Message.create({
            conversationId: conv._id,
            sender: userAId,
            text: 'Hey there',
            readBy: [userAId],
        });

        const res = await request(app)
            .get('/api/conversations/requests')
            .set('Authorization', `Bearer ${tokenB}`);

        expect(res.status).toBe(200);
        expect(res.body[0].messagePreview.text).toBe('Hey there');
    });
});

describe('Message gating on pending conversations', () => {
    let convId;

    beforeEach(async () => {
        const conv = await Conversation.create({
            participants: [userAId, userBId].sort(),
            status: 'pending',
            initiator: userAId,
        });
        convId = conv._id.toString();
    });

    test('initiator can send messages to pending conversation', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Hello from initiator' });

        expect(res.status).toBe(201);
        expect(res.body.text).toBe('Hello from initiator');
    });

    test('recipient cannot send messages to pending conversation', async () => {
        const res = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenB}`)
            .send({ text: 'Should not work' });

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('accept the request first');
    });

    test('neither party can send messages to rejected conversation', async () => {
        await Conversation.findByIdAndUpdate(convId, { status: 'rejected' });

        const resA = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'Rejected A' });

        expect(resA.status).toBe(403);
        expect(resA.body.error).toContain('rejected');

        const resB = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenB}`)
            .send({ text: 'Rejected B' });

        expect(resB.status).toBe(403);
    });

    test('messages flow normally after acceptance', async () => {
        await request(app)
            .post(`/api/conversations/${convId}/accept`)
            .set('Authorization', `Bearer ${tokenB}`);

        const resA = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenA}`)
            .send({ text: 'After accept from A' });

        expect(resA.status).toBe(201);

        const resB = await request(app)
            .post(`/api/conversations/${convId}/messages`)
            .set('Authorization', `Bearer ${tokenB}`)
            .send({ text: 'After accept from B' });

        expect(resB.status).toBe(201);
    });
});
