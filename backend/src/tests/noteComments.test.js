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
const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const Note = require('../models/Note');
const NoteComment = require('../models/NoteComment');
const Otp = require('../models/Otp');

jest.setTimeout(60000);

let mongoServer;
let token, secondToken;
let userId, secondUserId;
let course;
let note;

const testUser = {
    email: 'commenter@purdue.edu',
    password: 'password123',
    displayName: 'Comment Tester',
    major: 'Computer Science',
    year: 'Junior',
};

const secondUser = {
    email: 'commenter2@purdue.edu',
    password: 'password123',
    displayName: 'Second Commenter',
    major: 'Math',
    year: 'Senior',
};

const testCourse = {
    courseCode: 'CS 30700',
    department: 'CS',
    title: 'Software Engineering I',
    semester: 'Spring 2026',
    credits: 3,
};

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {
        serverSelectionTimeoutMS: 60000,
        connectTimeoutMS: 60000,
    });
    await Course.syncIndexes();
    await Note.syncIndexes();
    await NoteComment.syncIndexes();
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await User.deleteMany({});
    await Course.deleteMany({});
    await Note.deleteMany({});
    await NoteComment.deleteMany({});
    await Otp.deleteMany({});

    // Register and login first user
    await request(app).post('/api/auth/register').send(testUser);
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });
    token = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Register and login second user
    await request(app).post('/api/auth/register').send(secondUser);
    const loginRes2 = await request(app)
        .post('/api/auth/login')
        .send({ email: secondUser.email, password: secondUser.password });
    secondToken = loginRes2.body.token;
    secondUserId = loginRes2.body.user.id;

    // Create course and note
    course = await Course.create(testCourse);
    note = await Note.create({
        courseId: course._id,
        uploadedBy: userId,
        title: 'Lecture 1 Notes',
        fileUrl: 'https://storage.googleapis.com/boilerspace-uploads/notes/test.pdf',
        fileName: 'test.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
    });

    // Enroll both users in the course
    await User.findByIdAndUpdate(userId, { $push: { courses: course._id } });
    await User.findByIdAndUpdate(secondUserId, { $push: { courses: course._id } });
});

// ── POST /api/notes/:noteId/comments ────────────────────────────

describe('POST /api/notes/:noteId/comments', () => {
    test('creates a comment successfully', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Great notes, thanks for sharing!' });

        expect(res.status).toBe(201);
        expect(res.body.content).toBe('Great notes, thanks for sharing!');
        expect(res.body.noteId).toBe(note._id.toString());
        expect(res.body.userId).toHaveProperty('displayName', 'Comment Tester');
        expect(res.body.userId).toHaveProperty('profilePictureUrl');
        expect(res.body.createdAt).toBeDefined();
    });

    test('returns 400 for empty content', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: '' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Comment content is required.');
    });

    test('returns 400 for whitespace-only content', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: '   ' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Comment content is required.');
    });

    test('returns 400 for missing content field', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Comment content is required.');
    });

    test('returns 400 for content exceeding 2000 characters', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'a'.repeat(2001) });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Comment cannot exceed 2000 characters.');
    });

    test('sanitizes HTML/script tags in content', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: '<script>alert("xss")</script>' });

        expect(res.status).toBe(201);
        expect(res.body.content).not.toContain('<script>');
        expect(res.body.content).toContain('&lt;script&gt;');
    });

    test('returns 404 for non-existent note', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/notes/${fakeId}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'Hello' });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found.');
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .send({ content: 'No auth' });

        expect(res.status).toBe(401);
    });
});

// ── GET /api/notes/:noteId/comments ─────────────────────────────

describe('GET /api/notes/:noteId/comments', () => {
    test('returns comments in chronological order', async () => {
        await NoteComment.create({ noteId: note._id, userId, content: 'First comment' });
        // Small delay to ensure different timestamps
        await new Promise(r => setTimeout(r, 50));
        await NoteComment.create({ noteId: note._id, userId: secondUserId, content: 'Second comment' });

        const res = await request(app)
            .get(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.comments).toHaveLength(2);
        expect(res.body.comments[0].content).toBe('First comment');
        expect(res.body.comments[1].content).toBe('Second comment');
        expect(res.body.total).toBe(2);
        expect(res.body.page).toBe(1);
    });

    test('populates user metadata on comments', async () => {
        await NoteComment.create({ noteId: note._id, userId, content: 'Test comment' });

        const res = await request(app)
            .get(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.body.comments[0].userId).toHaveProperty('displayName', 'Comment Tester');
        expect(res.body.comments[0].userId).toHaveProperty('email');
        expect(res.body.comments[0].userId).toHaveProperty('profilePictureUrl');
    });

    test('returns empty array when note has no comments', async () => {
        const res = await request(app)
            .get(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.comments).toEqual([]);
        expect(res.body.total).toBe(0);
    });

    test('supports pagination', async () => {
        // Create 3 comments
        for (let i = 1; i <= 3; i++) {
            await NoteComment.create({ noteId: note._id, userId, content: `Comment ${i}` });
            await new Promise(r => setTimeout(r, 50));
        }

        const res = await request(app)
            .get(`/api/notes/${note._id}/comments?page=1&limit=2`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.comments).toHaveLength(2);
        expect(res.body.total).toBe(3);
        expect(res.body.totalPages).toBe(2);
        expect(res.body.page).toBe(1);

        const res2 = await request(app)
            .get(`/api/notes/${note._id}/comments?page=2&limit=2`)
            .set('Authorization', `Bearer ${token}`);

        expect(res2.body.comments).toHaveLength(1);
        expect(res2.body.page).toBe(2);
    });

    test('returns 404 for non-existent note', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .get(`/api/notes/${fakeId}/comments`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Note not found.');
    });

    test('returns 401 without auth token', async () => {
        const res = await request(app)
            .get(`/api/notes/${note._id}/comments`);

        expect(res.status).toBe(401);
    });
});

// ── DELETE /api/notes/:noteId/comments/:commentId ───────────────

describe('DELETE /api/notes/:noteId/comments/:commentId', () => {
    test('deletes own comment successfully', async () => {
        const comment = await NoteComment.create({
            noteId: note._id,
            userId,
            content: 'Delete me',
        });

        const res = await request(app)
            .delete(`/api/notes/${note._id}/comments/${comment._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Comment deleted successfully.');

        const check = await NoteComment.findById(comment._id);
        expect(check).toBeNull();
    });

    test('returns 403 when deleting another user\'s comment', async () => {
        const comment = await NoteComment.create({
            noteId: note._id,
            userId,
            content: 'Not yours to delete',
        });

        const res = await request(app)
            .delete(`/api/notes/${note._id}/comments/${comment._id}`)
            .set('Authorization', `Bearer ${secondToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('You can only delete your own comments.');

        // Comment should still exist
        const check = await NoteComment.findById(comment._id);
        expect(check).not.toBeNull();
    });

    test('returns 404 for non-existent comment', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/notes/${note._id}/comments/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Comment not found.');
    });

    test('returns 404 when comment belongs to a different note', async () => {
        const otherNote = await Note.create({
            courseId: course._id,
            uploadedBy: userId,
            title: 'Other Note',
            fileUrl: 'https://storage.googleapis.com/boilerspace-uploads/notes/other.pdf',
            fileName: 'other.pdf',
            fileSize: 1024,
            fileType: 'application/pdf',
        });
        const comment = await NoteComment.create({
            noteId: otherNote._id,
            userId,
            content: 'Wrong note',
        });

        const res = await request(app)
            .delete(`/api/notes/${note._id}/comments/${comment._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Comment not found.');
    });

    test('returns 401 without auth token', async () => {
        const comment = await NoteComment.create({
            noteId: note._id,
            userId,
            content: 'No auth',
        });

        const res = await request(app)
            .delete(`/api/notes/${note._id}/comments/${comment._id}`);

        expect(res.status).toBe(401);
    });
});

// ── Cascade Delete ──────────────────────────────────────────────

describe('Cascade delete comments on note deletion', () => {
    test('deleting a note removes all its comments', async () => {
        // Create comments on the note
        await NoteComment.create({ noteId: note._id, userId, content: 'Comment 1' });
        await NoteComment.create({ noteId: note._id, userId: secondUserId, content: 'Comment 2' });
        await NoteComment.create({ noteId: note._id, userId, content: 'Comment 3' });

        expect(await NoteComment.countDocuments({ noteId: note._id })).toBe(3);

        // Delete the note
        const res = await request(app)
            .delete(`/api/notes/${note._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);

        // All comments should be gone
        expect(await NoteComment.countDocuments({ noteId: note._id })).toBe(0);
    });

    test('deleting a note does not affect comments on other notes', async () => {
        const otherNote = await Note.create({
            courseId: course._id,
            uploadedBy: userId,
            title: 'Other Note',
            fileUrl: 'https://storage.googleapis.com/boilerspace-uploads/notes/other.pdf',
            fileName: 'other.pdf',
            fileSize: 1024,
            fileType: 'application/pdf',
        });

        await NoteComment.create({ noteId: note._id, userId, content: 'On deleted note' });
        await NoteComment.create({ noteId: otherNote._id, userId, content: 'On surviving note' });

        await request(app)
            .delete(`/api/notes/${note._id}`)
            .set('Authorization', `Bearer ${token}`);

        expect(await NoteComment.countDocuments({ noteId: note._id })).toBe(0);
        expect(await NoteComment.countDocuments({ noteId: otherNote._id })).toBe(1);
    });
});

// ── Course Enrollment Access Control ─────────────────────────────

describe('Course enrollment access control', () => {
    let unenrolledToken;

    beforeEach(async () => {
        // Register a third user who is NOT enrolled in the course
        await request(app).post('/api/auth/register').send({
            email: 'outsider@purdue.edu',
            password: 'password123',
            displayName: 'Outsider',
            major: 'History',
            year: 'Freshman',
        });
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'outsider@purdue.edu', password: 'password123' });
        unenrolledToken = loginRes.body.token;
    });

    test('returns 403 when non-enrolled user tries to post a comment', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${unenrolledToken}`)
            .send({ content: 'I am not enrolled' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('You must be enrolled in this course to comment.');
    });

    test('returns 403 when non-enrolled user tries to view comments', async () => {
        const res = await request(app)
            .get(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${unenrolledToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('You must be enrolled in this course to view comments.');
    });

    test('returns 403 when non-enrolled user tries to delete a comment', async () => {
        const comment = await NoteComment.create({
            noteId: note._id,
            userId,
            content: 'Enrolled user comment',
        });

        const res = await request(app)
            .delete(`/api/notes/${note._id}/comments/${comment._id}`)
            .set('Authorization', `Bearer ${unenrolledToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('You must be enrolled in this course to manage comments.');

        // Comment should still exist
        const check = await NoteComment.findById(comment._id);
        expect(check).not.toBeNull();
    });

    test('enrolled user can post a comment successfully', async () => {
        const res = await request(app)
            .post(`/api/notes/${note._id}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ content: 'I am enrolled!' });

        expect(res.status).toBe(201);
        expect(res.body.content).toBe('I am enrolled!');
    });
});

// ── NoteComment Schema Validation ───────────────────────────────

describe('NoteComment Schema Validation', () => {
    test('saves a valid comment', async () => {
        const comment = await NoteComment.create({
            noteId: note._id,
            userId,
            content: 'Valid comment',
        });
        expect(comment._id).toBeDefined();
        expect(comment.content).toBe('Valid comment');
        expect(comment.createdAt).toBeDefined();
    });

    test('rejects comment with empty content', async () => {
        await expect(
            NoteComment.create({ noteId: note._id, userId, content: '' })
        ).rejects.toThrow();
    });

    test('rejects comment without noteId', async () => {
        await expect(
            NoteComment.create({ userId, content: 'No note' })
        ).rejects.toThrow();
    });

    test('rejects comment without userId', async () => {
        await expect(
            NoteComment.create({ noteId: note._id, content: 'No user' })
        ).rejects.toThrow();
    });

    test('rejects comment exceeding max length', async () => {
        await expect(
            NoteComment.create({
                noteId: note._id,
                userId,
                content: 'a'.repeat(2001),
            })
        ).rejects.toThrow();
    });
});
