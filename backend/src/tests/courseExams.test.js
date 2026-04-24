const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const { signToken } = require('../config/jwt');

let mongoServer;
let user, token, course;

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

    user = await User.create({
        email: 'rohan@purdue.edu',
        password: 'password123',
        displayName: 'Rohan',
        major: 'CS',
        year: 'Junior',
    });
    token = signToken(user);

    course = await Course.create({
        courseCode: 'CS30700',
        title: 'Software Engineering',
        department: 'CS',
        semester: 'Spring 2026',
    });
});

describe('GET /api/courses/:id/exams', () => {
    test('returns empty array for a course with no exams', async () => {
        const res = await request(app).get(`/api/courses/${course._id}/exams`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns exams sorted chronologically', async () => {
        course.exams.push(
            { title: 'Final', date: new Date('2026-05-10T12:00:00Z') },
            { title: 'Midterm 1', date: new Date('2026-02-20T12:00:00Z') },
            { title: 'Midterm 2', date: new Date('2026-03-25T12:00:00Z') }
        );
        await course.save();

        const res = await request(app).get(`/api/courses/${course._id}/exams`);

        expect(res.status).toBe(200);
        expect(res.body.map((e) => e.title)).toEqual([
            'Midterm 1',
            'Midterm 2',
            'Final',
        ]);
    });

    test('returns 404 for a non-existent course id', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app).get(`/api/courses/${fakeId}/exams`);

        expect(res.status).toBe(404);
    });

    test('returns 404 for a malformed course id', async () => {
        const res = await request(app).get('/api/courses/not-a-real-id/exams');

        expect(res.status).toBe(404);
    });
});

describe('POST /api/courses/:id/exams', () => {
    test('creates an exam and returns the updated sorted list', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Midterm 1',
                date: '2026-03-15T19:00:00Z',
                location: 'WALC 1055',
            });

        expect(res.status).toBe(201);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Midterm 1');
        expect(res.body[0].location).toBe('WALC 1055');
    });

    test('persists the exam to the database', async () => {
        await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Final',
                date: '2026-05-01T14:00:00Z',
            });

        const dbCourse = await Course.findById(course._id);
        expect(dbCourse.exams).toHaveLength(1);
        expect(dbCourse.exams[0].title).toBe('Final');
    });

    test('returns exams sorted after appending an earlier exam', async () => {
        course.exams.push({
            title: 'Final',
            date: new Date('2026-05-10T12:00:00Z'),
        });
        await course.save();

        const res = await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                title: 'Midterm 1',
                date: '2026-02-20T12:00:00Z',
            });

        expect(res.status).toBe(201);
        expect(res.body.map((e) => e.title)).toEqual(['Midterm 1', 'Final']);
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .send({ title: 'Midterm 1', date: '2026-03-15T19:00:00Z' });

        expect(res.status).toBe(401);
    });

    test('returns 400 when title is missing', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2026-03-15T19:00:00Z' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('title');
    });

    test('returns 400 when title is an empty string', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: '   ', date: '2026-03-15T19:00:00Z' });

        expect(res.status).toBe(400);
    });

    test('returns 400 when date is missing', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Midterm 1' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('date');
    });

    test('returns 400 when date is invalid', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Midterm 1', date: 'not-a-date' });

        expect(res.status).toBe(400);
    });

    test('returns 404 for a non-existent course id', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/courses/${fakeId}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Midterm 1', date: '2026-03-15T19:00:00Z' });

        expect(res.status).toBe(404);
    });

    test('returns 404 for a malformed course id', async () => {
        const res = await request(app)
            .post('/api/courses/not-a-real-id/exams')
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Midterm 1', date: '2026-03-15T19:00:00Z' });

        expect(res.status).toBe(404);
    });

    test('stores location as empty string when omitted', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/exams`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Midterm 1', date: '2026-03-15T19:00:00Z' });

        expect(res.status).toBe(201);
        expect(res.body[0].location).toBe('');
    });
});
