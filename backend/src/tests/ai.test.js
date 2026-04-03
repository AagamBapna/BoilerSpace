const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock GCS
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

// Mock Gemini models
jest.mock('../config/gemini', () => ({
    model: {
        generateContent: jest.fn().mockResolvedValue({
            response: {
                text: () => '## Key Topics\n\n- **Topic 1**: Important concept\n- **Topic 2**: Another concept\n\n## Exam Focus Areas\n\nFocus on Topic 1.',
            },
        }),
    },
    embeddingModel: {
        embedContent: jest.fn().mockResolvedValue({
            embedding: { values: new Array(3072).fill(0.1) },
        }),
    },
}));

const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const Embedding = require('../models/Embedding');
const StudyGuide = require('../models/StudyGuide');
const Otp = require('../models/Otp');
jest.setTimeout(30000);
let mongoServer;
let token;
let userId;
let course;

const testUser = {
    email: 'aistudent@purdue.edu',
    password: 'password123',
    displayName: 'AI Tester',
    major: 'Computer Science',
    year: 'Junior',
};

const testCourse = {
    courseCode: 'CS 40800',
    department: 'CS',
    title: 'Software Testing',
    semester: 'Spring 2026',
    credits: 3,
};

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
    await Embedding.deleteMany({});
    await StudyGuide.deleteMany({});
    await Otp.deleteMany({});
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
    token = loginRes.body.token;
    userId = loginRes.body.user.id;

    course = await Course.create(testCourse);
});

describe('POST /api/courses/:id/study-guide', () => {
    test('returns 401 if not authenticated', async () => {
        const res = await request(app).post(`/api/courses/${course._id}/study-guide`);
        expect(res.status).toBe(401);
    });
    test('returns 404 if course not found', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/courses/${fakeId}/study-guide`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Course not found');
    });
    test('returns 404 if no embeddings exist for course', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/study-guide`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/No PDF notes found|No embedded notes/);
    });
    test('generates study guide when embeddings exist', async () => {
        // Seed embeddings
        await Embedding.insertMany([
            {
                courseId: course._id,
                noteId: new mongoose.Types.ObjectId(),
                chunkIndex: 0,
                text: 'Node coverage requires visiting every node in the CFG.',
                embedding: new Array(3072).fill(0.1),
                source: 'Lecture 1',
            },
            {
                courseId: course._id,
                noteId: new mongoose.Types.ObjectId(),
                chunkIndex: 1,
                text: 'Edge coverage requires traversing every edge in the CFG.',
                embedding: new Array(3072).fill(0.2),
                source: 'Lecture 1',
            },
        ]);
        const res = await request(app)
            .post(`/api/courses/${course._id}/study-guide`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.studyGuide).toBeDefined();
        expect(res.body.studyGuide).toContain('Key Topics');
        expect(res.body.notesUsed).toBeGreaterThan(0);
        expect(res.body.id).toBeDefined();
    });
    test('saves generated study guide to history', async () => {
        await Embedding.create({
            courseId: course._id,
            noteId: new mongoose.Types.ObjectId(),
            chunkIndex: 0,
            text: 'Test content for saving.',
            embedding: new Array(3072).fill(0.1),
            source: 'Test Note',
        });
        await request(app)
            .post(`/api/courses/${course._id}/study-guide`)
            .set('Authorization', `Bearer ${token}`);
        const saved = await StudyGuide.find({ courseId: course._id });
        expect(saved.length).toBe(1);
        expect(saved[0].content).toContain('Key Topics');
        expect(saved[0].userId.toString()).toBe(userId);
    });
});

describe('GET /api/courses/:id/study-guides', () => {
    test('returns 401 if not authenticated', async () => {
        const res = await request(app).get(`/api/courses/${course._id}/study-guides`);
        expect(res.status).toBe(401);
    });
    test('returns empty array when no guides exist', async () => {
        const res = await request(app)
            .get(`/api/courses/${course._id}/study-guides`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
    test('returns study guide history sorted by newest first', async () => {
        await StudyGuide.create({
            courseId: course._id,
            userId,
            content: 'Old guide',
            notesUsed: 2,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        await StudyGuide.create({
            courseId: course._id,
            userId,
            content: 'New guide',
            notesUsed: 5,
        });
        const res = await request(app)
            .get(`/api/courses/${course._id}/study-guides`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0].content).toBe('New guide');
        expect(res.body[0].notesUsed).toBe(5);
        expect(res.body[0].createdAt).toBeDefined();
    });
});