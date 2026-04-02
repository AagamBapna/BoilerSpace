const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

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
});

describe('GET /api/conversations', () => {
    test('lists conversations sorted by most recent', async () => {
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
});

describe('GET /api/conversations/:id/messages', () => {
    let convId;

    beforeEach(async () => {
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
