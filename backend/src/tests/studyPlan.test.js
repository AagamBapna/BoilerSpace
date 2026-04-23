const request = require('supertest');
const mongoose = require('mongoose');
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

jest.mock('../config/gemini', () => ({
    model: {
        generateContent: jest.fn(),
    },
    embeddingModel: null,
}));

jest.mock('../utils/pdfExtractor', () => ({
    extractTextFromPDF: jest.fn(),
    chunkText: jest.fn(),
    findRelevantChunks: jest.fn(),
}));

const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const StudyPlan = require('../models/StudyPlan');
const Otp = require('../models/Otp');
const { model } = require('../config/gemini');
jest.setTimeout(30000);
let mongoServer, token, userId, course1, course2;
const testUser = {
    email: 'studyplan@purdue.edu',
    password: 'password123',
    displayName: 'Plan Tester',
    major: 'Computer Science',
    year: 'Junior',
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
    jest.clearAllMocks();
    await User.deleteMany({});
    await Course.deleteMany({});
    await StudyPlan.deleteMany({});
    await Otp.deleteMany({});
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
    token = loginRes.body.token;
    userId = loginRes.body.user.id;
    course1 = await Course.create({
        courseCode: 'CS 30700', department: 'CS',
        title: 'Software Engineering I',
        semester: 'Spring 2026', credits: 3,
    });
    course2 = await Course.create({
        courseCode: 'CS 40800', department: 'CS',
        title: 'Software Testing',
        semester: 'Spring 2026', credits: 4,
    });
});

const mockGeminiBlocks = {
    blocks: [
        { day: '2026-04-20', startTime: '09:00', endTime: '10:30',
          courseCode: 'CS 30700', topic: 'Review different UML diagrams' },
        { day: '2026-04-21', startTime: '14:00', endTime: '15:00',
          courseCode: 'CS 40800', topic: 'Review execution tree creation' },
    ],
};

describe('POST /api/courses/study-plan/generate', () => {
    test('returns 401 if not authenticated', async () => {
        const res = await request(app).post('/api/courses/study-plan/generate');
        expect(res.status).toBe(401);
    });
    test('returns 400 if no courses provided', async () => {
        const res = await request(app)
            .post('/api/courses/study-plan/generate')
            .set('Authorization', `Bearer ${token}`)
            .send({ courses: [] });
        expect(res.status).toBe(400);
    });
    test('returns 400 if course missing examDate', async () => {
        const res = await request(app)
            .post('/api/courses/study-plan/generate')
            .set('Authorization', `Bearer ${token}`)
            .send({ courses: [{ courseId: course1._id }] });
        expect(res.status).toBe(400);
    });
    test('generates a valid study plan', async () => {
        model.generateContent.mockResolvedValue({
            response: { text: () => JSON.stringify(mockGeminiBlocks) },
        });
        const res = await request(app)
            .post('/api/courses/study-plan/generate')
            .set('Authorization', `Bearer ${token}`)
            .send({
                courses: [
                    { courseId: course1._id.toString(), examDate: '2026-04-25', priority: 'high' },
                    { courseId: course2._id.toString(), examDate: '2026-04-28', priority: 'medium' },
                ],
                preferredStudyHours: { startTime: '09:00', endTime: '21:00' },
                busySlots: [{ day: 'Monday', startTime: '12:00', endTime: '13:00', label: 'Lunch' }],
            });
        expect(res.status).toBe(200);
        expect(res.body.blocks.length).toBe(2);
        expect(res.body.blocks[0]).toHaveProperty('day');
        expect(res.body.blocks[0]).toHaveProperty('topic');
    });

    test('saves plan to database', async () => {
        model.generateContent.mockResolvedValue({
            response: { text: () => JSON.stringify(mockGeminiBlocks) },
        });
        await request(app)
            .post('/api/courses/study-plan/generate')
            .set('Authorization', `Bearer ${token}`)
            .send({
                courses: [{ courseId: course1._id.toString(), examDate: '2026-04-25', priority: 'high' }],
            });
        const saved = await StudyPlan.find({ userId });
        expect(saved.length).toBe(1);
    });
});

describe('GET /api/courses/study-plan/history', () => {
    test('returns 401 if not authenticated', async () => {
        const res = await request(app).get('/api/courses/study-plan/history');
        expect(res.status).toBe(401);
    });
    test('returns empty array when no plans exist', async () => {
        const res = await request(app)
            .get('/api/courses/study-plan/history')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
    test('returns plans sorted newest first', async () => {
        await StudyPlan.create({
            userId, title: 'Old',
            courses: [{ courseId: course1._id, examDate: new Date() }],
            blocks: [{ day: '2026-04-20', startTime: '09:00', endTime: '10:00', courseCode: 'CS 25100', topic: 'x' }],
            createdAt: new Date('2026-01-01'),
        });
        await StudyPlan.create({
            userId, title: 'New',
            courses: [{ courseId: course1._id, examDate: new Date() }],
            blocks: [{ day: '2026-04-21', startTime: '09:00', endTime: '10:00', courseCode: 'CS 25100', topic: 'y' }],
            createdAt: new Date('2026-01-02'),
        });
        const res = await request(app)
            .get('/api/courses/study-plan/history')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0].title).toBe('New');
    });
});

describe('PUT /api/courses/study-plan/:planId', () => {
    test('returns 404 for non-existent plan', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .put(`/api/courses/study-plan/${fakeId}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ blocks: [] });
        expect(res.status).toBe(404);
    });
    test('returns 403 if editing another user plan', async () => {
        const other = await User.create({
            email: 'other@purdue.edu', password: 'password123',
            displayName: 'Other', major: 'Computer Science', year: 'Senior',
        });
        const plan = await StudyPlan.create({
            userId: other._id, title: 'Other',
            courses: [{ courseId: course1._id, examDate: new Date() }],
            blocks: [],
        });
        const res = await request(app)
            .put(`/api/courses/study-plan/${plan._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ blocks: [] });
        expect(res.status).toBe(403);
    });
    test('updates blocks successfully', async () => {
        const plan = await StudyPlan.create({
            userId, title: 'My',
            courses: [{ courseId: course1._id, examDate: new Date() }],
            blocks: [{ day: '2026-04-20', startTime: '09:00', endTime: '10:00', courseCode: 'CS 25100', topic: 'Old' }],
        });
        const res = await request(app)
            .put(`/api/courses/study-plan/${plan._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ blocks: [
                { day: '2026-04-22', startTime: '14:00', endTime: '15:00', courseCode: 'CS 25100', topic: 'New' },
            ] });
        expect(res.status).toBe(200);
        expect(res.body.blocks.length).toBe(1);
        expect(res.body.blocks[0].topic).toBe('New');
    });
});