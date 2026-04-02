const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Otp = require('../models/Otp');
const Note = require('../models/Note');
const CheckIn = require('../models/CheckIn');
const Course = require('../models/Course');
const Building = require('../models/Building');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Friendship = require('../models/Friendship');

let mongoServer;

const validUser = {
    email: 'delete@purdue.edu',
    password: 'password123',
    displayName: 'Delete User',
    major: 'Computer Science',
    year: 'Senior'
};

async function loginUser(email, password) {
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password });
    return res.body.token;
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
    await Otp.deleteMany({});
    await Note.deleteMany({});
    await CheckIn.deleteMany({});
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    await Friendship.deleteMany({});
});

describe('POST /api/auth/request-delete-otp', () => {
    test('sends OTP to authenticated user', async () => {
        await User.create(validUser);
        const token = await loginUser(validUser.email, validUser.password);

        await Otp.deleteMany({ email: validUser.email });

        const res = await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Deletion verification code sent to your email');

        const otp = await Otp.findOne({ email: validUser.email });
        expect(otp).toBeDefined();
        expect(otp.code).toMatch(/^\d{6}$/);
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .post('/api/auth/request-delete-otp');

        expect(res.status).toBe(401);
    });
});

describe('POST /api/auth/confirm-delete', () => {
    test('deletes user with valid OTP', async () => {
        await User.create(validUser);
        const token = await loginUser(validUser.email, validUser.password);

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        const otp = await Otp.findOne({ email: validUser.email });

        const res = await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: otp.code });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Account deleted successfully');

        const user = await User.findOne({ email: validUser.email });
        expect(user).toBeNull();
    });

    test('rejects wrong OTP and user still exists', async () => {
        await User.create(validUser);
        const token = await loginUser(validUser.email, validUser.password);

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: '000000' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid or expired verification code');

        const user = await User.findOne({ email: validUser.email });
        expect(user).not.toBeNull();
    });

    test('rejects missing code', async () => {
        await User.create(validUser);
        const token = await loginUser(validUser.email, validUser.password);

        const res = await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Verification code is required');
    });

    test('old JWT returns 401 after deletion', async () => {
        await User.create(validUser);
        const token = await loginUser(validUser.email, validUser.password);

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        const otp = await Otp.findOne({ email: validUser.email });

        await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: otp.code });

        const meRes = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(meRes.status).toBe(401);
    });

    test('deleted user can re-register with same email', async () => {
        await User.create(validUser);
        const token = await loginUser(validUser.email, validUser.password);

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        const otp = await Otp.findOne({ email: validUser.email });

        await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: otp.code });

        const registerRes = await request(app)
            .post('/api/auth/register')
            .send(validUser);

        expect(registerRes.status).toBe(201);
        expect(registerRes.body.message).toBe('Account created successfully');
    });

    test('login returns 401 for deleted user', async () => {
        await User.create(validUser);
        const token = await loginUser(validUser.email, validUser.password);

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        const otp = await Otp.findOne({ email: validUser.email });

        await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: otp.code });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: validUser.email, password: validUser.password });

        expect(loginRes.status).toBe(401);
        expect(loginRes.body.error).toBe('Invalid email or password');
    });

    test('cascading delete removes notes and check-ins', async () => {
        const user = await User.create(validUser);

        const course = await Course.create({
            courseCode: 'CS 180',
            title: 'Problem Solving',
            department: 'CS',
            semester: 'Fall 2025',
        });

        await Note.create({
            courseId: course._id,
            uploadedBy: user._id,
            title: 'Test Note',
            fileUrl: 'http://example.com/note.pdf',
            fileName: 'note.pdf',
            fileSize: 1024,
            fileType: 'application/pdf',
        });

        const building = await Building.create({
            name: 'Test Building',
            abbreviation: 'TB',
            address: '123 Test St',
            latitude: 40.42,
            longitude: -86.91,
        });

        const room = await Room.create({
            buildingId: building._id,
            name: 'Room 101',
            capacity: 30,
            currentOccupancy: 1,
        });

        await CheckIn.create({
            buildingId: building._id,
            roomId: room._id,
            userId: user._id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const token = await loginUser(validUser.email, validUser.password);

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        const otp = await Otp.findOne({ email: validUser.email });

        await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: otp.code });

        const notes = await Note.find({ uploadedBy: user._id });
        expect(notes).toHaveLength(0);

        const checkins = await CheckIn.find({ userId: user._id });
        expect(checkins).toHaveLength(0);

        const otps = await Otp.find({ email: validUser.email });
        expect(otps).toHaveLength(0);
    });

    test('cascading delete removes messages, conversations, and friendships', async () => {
        const user = await User.create(validUser);
        const otherUser = await User.create({
            email: 'partner@purdue.edu',
            password: 'password123',
            displayName: 'Partner User',
            major: 'Math',
            year: 'Junior',
        });

        const conversation = await Conversation.create({
            participants: [user._id, otherUser._id],
            lastMessage: {
                text: 'hello',
                sender: user._id,
                timestamp: new Date(),
            },
        });

        await Message.create({
            conversationId: conversation._id,
            sender: user._id,
            text: 'hello',
            readBy: [user._id],
        });

        await Friendship.create({
            requester: user._id,
            recipient: otherUser._id,
            status: 'accepted',
        });

        const token = await loginUser(validUser.email, validUser.password);

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        const otp = await Otp.findOne({ email: validUser.email });

        await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: otp.code });

        const messages = await Message.find({ sender: user._id });
        expect(messages).toHaveLength(0);

        const conversations = await Conversation.find({ participants: user._id });
        expect(conversations).toHaveLength(0);

        const friendships = await Friendship.find({
            $or: [{ requester: user._id }, { recipient: user._id }],
        });
        expect(friendships).toHaveLength(0);
    });

    test('returns error when messaging a deleted user from old conversation', async () => {
        const deletedUser = await User.create(validUser);
        const sender = await User.create({
            email: 'sender@purdue.edu',
            password: 'password123',
            displayName: 'Sender User',
            major: 'ECE',
            year: 'Sophomore',
        });

        const conversation = await Conversation.create({
            participants: [deletedUser._id, sender._id],
        });

        const deletedToken = await loginUser(validUser.email, validUser.password);
        const senderToken = await loginUser('sender@purdue.edu', 'password123');

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${deletedToken}`);

        const otp = await Otp.findOne({ email: validUser.email });

        await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${deletedToken}`)
            .send({ code: otp.code });

        const res = await request(app)
            .post(`/api/conversations/${conversation._id}/messages`)
            .set('Authorization', `Bearer ${senderToken}`)
            .send({ text: 'Can you see this?' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Conversation not found');
    });

    test('cascading delete removes user votes from other notes', async () => {
        const user = await User.create(validUser);
        const otherUser = await User.create({
            email: 'other@purdue.edu',
            password: 'password123',
            displayName: 'Other User',
            major: 'Math',
            year: 'Junior',
        });

        const course = await Course.create({
            courseCode: 'CS 250',
            title: 'Computer Architecture',
            department: 'CS',
            semester: 'Fall 2025',
        });

        const note = await Note.create({
            courseId: course._id,
            uploadedBy: otherUser._id,
            title: 'Other Note',
            fileUrl: 'http://example.com/other.pdf',
            fileName: 'other.pdf',
            fileSize: 2048,
            fileType: 'application/pdf',
            votes: [
                { user: user._id, vote: 'up' },
                { user: otherUser._id, vote: 'up' },
            ],
            voteCount: 2,
        });

        const token = await loginUser(validUser.email, validUser.password);

        await request(app)
            .post('/api/auth/request-delete-otp')
            .set('Authorization', `Bearer ${token}`);

        const otp = await Otp.findOne({ email: validUser.email });

        await request(app)
            .post('/api/auth/confirm-delete')
            .set('Authorization', `Bearer ${token}`)
            .send({ code: otp.code });

        const updatedNote = await Note.findById(note._id);
        expect(updatedNote).not.toBeNull();
        expect(updatedNote.votes).toHaveLength(1);
        expect(updatedNote.votes[0].user.toString()).toBe(otherUser._id.toString());
        expect(updatedNote.voteCount).toBe(1);
    });
});
