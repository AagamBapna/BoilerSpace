const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Course = require('../models/Course');

let mongoServer;

const sampleCourses = [
    {
        courseCode: 'CS 30700',
        department: 'CS',
        title: 'Software Engineering I',
        semester: 'Spring 2026',
        credits: 3,
    },
    {
        courseCode: 'MA 26100',
        department: 'MA',
        title: 'Multivariate Calculus',
        semester: 'Spring 2026',
        credits: 4,
    },
    {
        courseCode: 'CS 25100',
        department: 'CS',
        title: 'Data Structures and Algorithms',
        semester: 'Spring 2026',
        credits: 3,
    },
    {
        courseCode: 'ECE 20001',
        department: 'ECE',
        title: 'Electrical Engineering Fundamentals I',
        semester: 'Spring 2026',
        credits: 4,
    },
];

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Course.deleteMany({});
});

describe('Course Schema Validation', () => {
    test('saves a valid course', async () => {
        const course = new Course(sampleCourses[0]);
        const saved = await course.save();
        expect(saved._id).toBeDefined();
        expect(saved.courseCode).toBe('CS 30700');
        expect(saved.title).toBe('Software Engineering I');
        expect(saved.semester).toBe('Spring 2026');
    });

    test('rejects a course missing required courseCode', async () => {
        const course = new Course({ department: 'CS', title: 'Some Course', semester: 'Spring 2026' });
        await expect(course.save()).rejects.toThrow();
    });

    test('rejects a course missing required title', async () => {
        const course = new Course({ courseCode: 'CS 99999', department: 'CS', semester: 'Spring 2026' });
        await expect(course.save()).rejects.toThrow();
    });

    test('rejects a course missing required semester', async () => {
        const course = new Course({ courseCode: 'CS 99999', department: 'CS', title: 'Some Course' });
        await expect(course.save()).rejects.toThrow();
    });

    test('rejects duplicate course codes', async () => {
        await Course.create(sampleCourses[0]);
        const duplicate = new Course({ ...sampleCourses[0] });
        await expect(duplicate.save()).rejects.toThrow();
    });

    test('stores courseCode and department in uppercase', async () => {
        const course = await Course.create({
            courseCode: 'cs 30700',
            department: 'cs',
            title: 'Software Engineering I',
            semester: 'Spring 2026',
        });
        expect(course.courseCode).toBe('CS 30700');
        expect(course.department).toBe('CS');
    });

    test('defaults credits to 3', async () => {
        const course = await Course.create({
            courseCode: 'CS 11111',
            department: 'CS',
            title: 'Test Course',
            semester: 'Spring 2026',
        });
        expect(course.credits).toBe(3);
    });
});

describe('GET /api/courses', () => {
    beforeEach(async () => {
        await Course.insertMany(sampleCourses);
    });

    // Acceptance Criteria: can view a comprehensive list of valid Purdue courses
    test('returns 200 with all courses', async () => {
        const res = await request(app).get('/api/courses');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(4);
    });

    // Acceptance Criteria: courses display course code, title, and semester
    test('returns correct course fields', async () => {
        const res = await request(app).get('/api/courses');
        const cs307 = res.body.find((c) => c.courseCode === 'CS 30700');
        expect(cs307).toBeDefined();
        expect(cs307.title).toBe('Software Engineering I');
        expect(cs307.semester).toBe('Spring 2026');
        expect(cs307.department).toBe('CS');
        expect(cs307.credits).toBeDefined();
    });

    // Acceptance Criteria: browse course directory and see accurate class options
    test('returns courses sorted alphabetically by courseCode', async () => {
        const res = await request(app).get('/api/courses');
        const codes = res.body.map((c) => c.courseCode);
        const sorted = [...codes].sort((a, b) => a.localeCompare(b));
        expect(codes).toEqual(sorted);
    });

    test('returns empty array when no courses exist', async () => {
        await Course.deleteMany({});
        const res = await request(app).get('/api/courses');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    // Filtering by department
    test('filters courses by department query param', async () => {
        const res = await request(app).get('/api/courses?department=CS');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        res.body.forEach((c) => expect(c.department).toBe('CS'));
    });

    test('department filter is case-insensitive', async () => {
        const res = await request(app).get('/api/courses?department=cs');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    // Filtering by semester
    test('filters courses by semester query param', async () => {
        const res = await request(app).get('/api/courses?semester=Spring+2026');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(4);
    });

    test('returns empty array for a semester with no courses', async () => {
        const res = await request(app).get('/api/courses?semester=Fall+2099');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

describe('GET /api/courses/:id', () => {
    let course;

    beforeEach(async () => {
        course = await Course.create(sampleCourses[0]);
    });

    // Acceptance Criteria: selecting a course shows correct title and semester
    test('returns the correct course by id', async () => {
        const res = await request(app).get(`/api/courses/${course._id}`);
        expect(res.status).toBe(200);
        expect(res.body.courseCode).toBe('CS 30700');
        expect(res.body.title).toBe('Software Engineering I');
        expect(res.body.semester).toBe('Spring 2026');
    });

    test('returns 404 for a non-existent course id', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app).get(`/api/courses/${fakeId}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Course not found');
    });

    test('returns 404 for a malformed id', async () => {
        const res = await request(app).get('/api/courses/not-a-valid-id');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Course not found');
    });
});

describe('No duplicate courses after re-seed', () => {
    async function runSeedLogic() {
        await Course.deleteMany({});
        await Course.insertMany(sampleCourses);
    }

    test('courses appear exactly once after two seed runs', async () => {
        await runSeedLogic();
        await runSeedLogic();

        const count = await Course.countDocuments();
        expect(count).toBe(sampleCourses.length);
    });
});