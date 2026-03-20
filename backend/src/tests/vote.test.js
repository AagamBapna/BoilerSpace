const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
jest.mock('../config/gcs', () => ({
    bucket: {
        name: 'boilerspace-uploads',
        file: (name) => ({
            name,
            createWriteStream: () => {
                const { PassThrough } = require('stream');
                const stream = new PassThrough();
                setTimeout(() => stream.emit('finish'), 10);
                return stream;
            },
            delete: () => Promise.resolve(),
        }),
    },
}));
const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const Note = require('../models/Note');
const Otp = require('../models/Otp');

jest.setTimeout(30000);

let mongoServer;
let token;
let testNote;

let testUser = {
    email: 'noter@purdue.edu',
    password: 'password123',
    displayName: 'Note Tester',
    major: 'Computer Science',
    year: 'Junior',
};

let testCourse = {
    courseCode: 'CS 30700',
    department: 'CS',
    title: 'Software Engineering I',
    semester: 'Spring 2026',
    credits: 3,
};

const uploadsDir = path.join(__dirname, '../../uploads');

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    await Course.deleteMany({});
    await Note.deleteMany({});
    await Otp.deleteMany({});
    await request(app).post('/api/auth/register').send(testUser);
    await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
    });
    const otp = await Otp.findOne({ email: testUser.email });
    const verifyRes = await request(app)
        .post('/api/auth/verify-login-otp')
        .send({ email: testUser.email, password: testUser.password, code: otp.code });
    token = verifyRes.body.token;
    const loggedInUser = verifyRes.body.user;
    const createdCourse = await Course.create(testCourse);
    testNote = await Note.create({
        courseId: createdCourse._id,
        uploadedBy: loggedInUser.id,
        title: 'Test Note',
        description: 'This is a test note.',
        fileUrl: '/uploads/test-note.pdf',
        fileName: 'test-note.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
    });
});

describe('POST /api/notes/:noteId/vote', () => {
    test('upvote increases vote count by 1', async () => {
        const response = await request(app)
            .post(`/api/notes/${testNote._id}/vote`)
            .set('Authorization', `Bearer ${token}`)
            .send({ vote: 'up' });
        expect(response.status).toBe(200);
        expect(response.body.voteCount).toBe(1);
        expect(response.body.userVote).toBe('up');
    });
    
    test('downvote decreases vote count by 1', async () => {
        const response = await request(app)
            .post(`/api/notes/${testNote._id}/vote`)
            .set('Authorization', `Bearer ${token}`)
            .send({ vote: 'down' });
        expect(response.status).toBe(200);
        expect(response.body.voteCount).toBe(-1);
        expect(response.body.userVote).toBe('down');
    });

    test('duplicate upvote results in 400 error', async () => {
        await request(app)
            .post(`/api/notes/${testNote._id}/vote`)
            .set('Authorization', `Bearer ${token}`)
            .send({ vote: 'up' });
        const response = await request(app)
            .post(`/api/notes/${testNote._id}/vote`)
            .set('Authorization', `Bearer ${token}`)
            .send({ vote: 'up' });
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('already');
    });

    test('changing vote from up to down updates vote count by -2', async () => {
        await request(app)
            .post(`/api/notes/${testNote._id}/vote`)
            .set('Authorization', `Bearer ${token}`)
            .send({ vote: 'up' });
        const response = await request(app)
            .post(`/api/notes/${testNote._id}/vote`)
            .set('Authorization', `Bearer ${token}`)
            .send({ vote: 'down' });
        expect(response.status).toBe(200);
        expect(response.body.voteCount).toBe(-1);
        expect(response.body.userVote).toBe('down');
    });

    test('vote while logged out returns 401', async () => {
        const response = await request(app)
            .post(`/api/notes/${testNote._id}/vote`)
            .send({ vote: 'up' });
        expect(response.status).toBe(401);
    });
});

