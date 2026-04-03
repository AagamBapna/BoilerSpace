const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
jest.mock('../config/gcs', () => ({
    isGcsConfigured: true,
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
let userId;
let course;

const testUser = {
    email: 'noter@purdue.edu',
    password: 'password123',
    displayName: 'Note Tester',
    major: 'Computer Science',
    year: 'Junior',
};

const testCourse = {
    courseCode: 'CS 30700',
    department: 'CS',
    title: 'Software Engineering I',
    semester: 'Spring 2026',
    credits: 3,
};

// Path to a tiny test PDF we create on the fly
const uploadsDir = path.join(__dirname, '../../uploads');
const testFilePath = path.join(__dirname, 'test-note.pdf');
const invalidFilePath = path.join(__dirname, 'test-note.txt');
const largeFilePath = path.join(__dirname, 'test-large.pdf');

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Course.syncIndexes();
    await Note.syncIndexes();

    // Create a small test file
    fs.writeFileSync(testFilePath, '%PDF-1.4 test content');
    fs.writeFileSync(invalidFilePath, 'not a pdf');
    fs.writeFileSync(largeFilePath, Buffer.alloc(16 * 1024 * 1024 + 1, 0));
});

afterAll(async () => {
    // Clean up test file
    if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
    if (fs.existsSync(largeFilePath)) fs.unlinkSync(largeFilePath);

    // Clean up any uploaded files from tests
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
        if (file !== '.gitkeep' && file !== '.gitignore') {
            fs.rmSync(path.join(uploadsDir, file), { recursive: true, force: true });
        }
    }

    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    await Course.deleteMany({});
    await Note.deleteMany({});
    await Otp.deleteMany({});

    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
    token = loginRes.body.token;
    userId = loginRes.body.user.id;

    course = await Course.create(testCourse);
});

// ── Note Schema Validation ──────────────────────────────────────

describe('Note Schema Validation', () => {
    test('saves a valid note', async () => {
        const note = await Note.create({
            courseId: course._id,
            uploadedBy: userId,
            title: 'Lecture 1 Notes',
            fileUrl: '/uploads/test.pdf',
            fileName: 'test.pdf',
            fileSize: 1024,
            fileType: 'application/pdf',
        });
        expect(note._id).toBeDefined();
        expect(note.title).toBe('Lecture 1 Notes');
        expect(note.description).toBe('');
    });

    test('rejects note missing required title', async () => {
        const note = new Note({
            courseId: course._id,
            uploadedBy: userId,
            fileUrl: '/uploads/test.pdf',
            fileName: 'test.pdf',
            fileSize: 1024,
            fileType: 'application/pdf',
        });
        await expect(note.save()).rejects.toThrow();
    });

    test('rejects invalid file type', async () => {
        const note = new Note({
            courseId: course._id,
            uploadedBy: userId,
            title: 'Bad File',
            fileUrl: '/uploads/test.exe',
            fileName: 'test.exe',
            fileSize: 1024,
            fileType: 'application/exe',
        });
        await expect(note.save()).rejects.toThrow();
    });

    test('rejects file size exceeding 16MB', async () => {
        const note = new Note({
            courseId: course._id,
            uploadedBy: userId,
            title: 'Huge File',
            fileUrl: '/uploads/huge.pdf',
            fileName: 'huge.pdf',
            fileSize: 17 * 1024 * 1024,
            fileType: 'application/pdf',
        });
        await expect(note.save()).rejects.toThrow();
    });
});

// ── POST /api/courses/:id/notes ─────────────────────────────────

describe('POST /api/courses/:id/notes', () => {
    test('uploads a note successfully', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('title', 'Lecture 1')
            .field('description', 'First lecture notes');

        expect(res.status).toBe(201);
        expect(res.body.title).toBe('Lecture 1');
        expect(res.body.description).toBe('First lecture notes');
        expect(res.body.uploadedBy).toHaveProperty('displayName', 'Note Tester');
        expect(res.body.courseId).toHaveProperty('courseCode', 'CS 30700');
    });

    test('uses filename as title when title not provided', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath);

        expect(res.status).toBe(201);
        expect(res.body.title).toBe('test-note.pdf');
    });

    test('returns 404 for non-existent course', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/courses/${fakeId}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('title', 'Orphan Note');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Course not found.');
    });

    test('returns 400 for invalid file type', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', invalidFilePath)
            .field('title', 'Bad Type');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid file type. Only PDF, PNG, and JPEG files are allowed.');
        expect(await Note.countDocuments()).toBe(0);
    });

    test('returns 400 when uploaded file exceeds 16MB', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', largeFilePath)
            .field('title', 'Too Large');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('File size exceeds the 16MB limit.');
        expect(await Note.countDocuments()).toBe(0);
    });

    test('returns 400 when no file is attached', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .field('title', 'No File');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No file uploaded. Please attach a PDF or image file.');
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .post(`/api/courses/${course._id}/notes`);

        expect(res.status).toBe(401);
    });
});

// ── GET /api/courses/:id/notes ──────────────────────────────────

describe('GET /api/courses/:id/notes', () => {
    test('returns notes for a course sorted by newest first', async () => {
        // Upload two notes
        await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('title', 'First Note');

        await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('title', 'Second Note');

        const res = await request(app)
            .get(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        // Newest first
        expect(res.body[0].title).toBe('Second Note');
        expect(res.body[1].title).toBe('First Note');
        // Populated fields
        expect(res.body[0].uploadedBy).toHaveProperty('displayName');
        expect(res.body[0].courseId).toHaveProperty('courseCode');
    });

    test('returns uploaded notes to another student in the same class', async () => {
        await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('title', 'Shared Note');

        const secondUser = {
            email: 'second-noter@purdue.edu',
            password: 'password123',
            displayName: 'Second Student',
            major: 'Computer Science',
            year: 'Sophomore',
        };

        await request(app).post('/api/auth/register').send(secondUser);
        const loginRes2 = await request(app)
            .post('/api/auth/login')
            .send({ email: secondUser.email, password: secondUser.password });
        const secondToken = loginRes2.body.token;
        const res = await request(app)
            .get(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${secondToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].title).toBe('Shared Note');
        expect(res.body[0].uploadedBy).toHaveProperty('displayName', 'Note Tester');
    });

    test('returns empty array when course has no notes', async () => {
        const res = await request(app)
            .get(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('returns 404 for non-existent course', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/courses/${fakeId}/notes`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Course not found.');
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .get(`/api/courses/${course._id}/notes`);

        expect(res.status).toBe(401);
    });
});

// ── GET /api/notes/:noteId/download ─────────────────────────────

describe('GET /api/notes/:noteId/download', () => {
    test('downloads a note file', async () => {
        const uploadRes = await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('title', 'Download Me');

        const noteId = uploadRes.body._id;

        const res = await request(app)
            .get(`/api/notes/${noteId}/download`)
            .set('Authorization', `Bearer ${token}`)
            .redirects(0);

        expect(res.status).toBe(302);
        expect(res.headers['location']).toContain('storage.googleapis.com');
    });

    test('returns 404 for non-existent note', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/notes/${fakeId}/download`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found.');
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .get(`/api/notes/${new mongoose.Types.ObjectId()}/download`);

        expect(res.status).toBe(401);
    });
});

// ── DELETE /api/notes/:noteId ───────────────────────────────────

describe('DELETE /api/notes/:noteId', () => {
    test('deletes own note successfully', async () => {
        const uploadRes = await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('title', 'Delete Me');

        const noteId = uploadRes.body._id;

        const res = await request(app)
            .delete(`/api/notes/${noteId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Note deleted successfully.');

        // Verify it's gone
        const check = await Note.findById(noteId);
        expect(check).toBeNull();
    });

    test('returns 403 when deleting another user\'s note', async () => {
        // Upload a note as the first user
        const uploadRes = await request(app)
            .post(`/api/courses/${course._id}/notes`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', testFilePath)
            .field('title', 'Not Yours');

        const noteId = uploadRes.body._id;

        // Register and login as a second user
        await request(app).post('/api/auth/register').send({
            email: 'other@purdue.edu',
            password: 'password123',
            displayName: 'Other User',
            major: 'Math',
            year: 'Senior',
        });
        const otherLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'other@purdue.edu', password: 'password123' });
        const otherToken = otherLoginRes.body.token;

        const res = await request(app)
            .delete(`/api/notes/${noteId}`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('You can only delete notes you uploaded.');
    });

    test('returns 404 for non-existent note', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/notes/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found.');
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .delete(`/api/notes/${new mongoose.Types.ObjectId()}`);

        expect(res.status).toBe(401);
    });
});
