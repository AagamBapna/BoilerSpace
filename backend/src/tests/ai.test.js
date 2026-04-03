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

jest.mock('../utils/pdfExtractor', () => ({
  extractTextFromPDF: jest.fn(),
  chunkText: jest.fn(),
  findRelevantChunks: jest.fn(),
}));

const app = require('../app');
const User = require('../models/User');
const Course = require('../models/Course');
const Note = require('../models/Note');
const Embedding = require('../models/Embedding');
const StudyGuide = require('../models/StudyGuide');
const Otp = require('../models/Otp');
const { model } = require('../config/gemini');
const { extractTextFromPDF, chunkText, findRelevantChunks } = require('../utils/pdfExtractor');

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
  courseCode: 'CS 38100',
  department: 'CS',
  title: 'Introduction to the Analysis of Algorithms',
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
  jest.clearAllMocks();
  await User.deleteMany({});
  await Course.deleteMany({});
  await Note.deleteMany({});
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

  extractTextFromPDF.mockResolvedValue('Recurrence relations and sorting analysis.');
  chunkText.mockReturnValue(['Recurrence relations and sorting analysis.']);
  findRelevantChunks.mockImplementation((chunks) => chunks.slice(0, 5));
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
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await StudyGuide.create({
      courseId: course._id,
      userId,
      content: 'New guide',
      notesUsed: 5,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
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

describe('POST /api/courses/:id/practice-questions', () => {
  test('returns 404 when no PDF notes exist for the course', async () => {
    const res = await request(app)
      .post(`/api/courses/${course._id}/practice-questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ count: 5, difficulty: 'medium', focus: 'recurrence' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No PDF notes found for this course');
  });

  test('returns generated practice questions in expected format', async () => {
    await Note.create({
      courseId: course._id,
      uploadedBy: userId,
      title: 'Lecture 3 Notes',
      description: 'Sorting and recurrence notes',
      fileUrl: 'https://example.com/lecture3.pdf',
      fileName: 'lecture3.pdf',
      fileSize: 1024,
      fileType: 'application/pdf',
    });

    model.generateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          questions: [
            {
              id: 'q1',
              question: 'How does the Master Theorem classify divide-and-conquer recurrences?',
              answer: 'Compare f(n) to n^log_b(a) and identify which case applies before simplifying.',
            },
          ],
        }),
      },
    });

    const res = await request(app)
      .post(`/api/courses/${course._id}/practice-questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ count: 1, difficulty: 'medium', focus: 'recurrence' });

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0]).toMatchObject({
      id: 'q1',
      question: expect.any(String),
      answer: expect.any(String),
    });
  });

  test('keeps concise real answers in reveal output', async () => {
    await Note.create({
      courseId: course._id,
      uploadedBy: userId,
      title: 'Lecture 5 Notes',
      description: 'Quicksort notes',
      fileUrl: 'https://example.com/lecture5.pdf',
      fileName: 'lecture5.pdf',
      fileSize: 1024,
      fileType: 'application/pdf',
    });

    model.generateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          questions: [
            {
              id: 'q1',
              question: 'Analyze quicksort on average case.',
              answer: 'Step 1: Partition around pivot. Step 2: Recurse on both sides. Therefore, the final answer is O(n log n).',
            },
          ],
        }),
      },
    });

    const res = await request(app)
      .post(`/api/courses/${course._id}/practice-questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ count: 1, difficulty: 'hard' });

    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0].answer).toMatch(/O\(n log n\)/i);
  });

  test('returns 400 when count is outside allowed range', async () => {
    const res = await request(app)
      .post(`/api/courses/${course._id}/practice-questions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ count: 20 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('count must be between 1 and 10');
  });
});

describe('POST /api/courses/:id/qa', () => {
  test('returns 404 when no PDF notes exist for the course', async () => {
    const res = await request(app)
      .post(`/api/courses/${course._id}/qa`)
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What is a recurrence relation?' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No PDF notes found for this course');
  });

  test('returns an answer based on course notes', async () => {
    await Note.create({
      courseId: course._id,
      uploadedBy: userId,
      title: 'Lecture 3 Notes',
      description: 'Sorting and recurrence notes',
      fileUrl: 'https://example.com/lecture3.pdf',
      fileName: 'lecture3.pdf',
      fileSize: 1024,
      fileType: 'application/pdf',
    });

    model.generateContent.mockResolvedValue({
      response: {
        text: () => 'A recurrence relation describes a function in terms of smaller inputs. Use the notes to identify the base case and recursive structure.',
      },
    });

    const res = await request(app)
      .post(`/api/courses/${course._id}/qa`)
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What is a recurrence relation?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/recurrence relation/i);
    expect(res.body.notesUsed).toBeGreaterThan(0);
  });

  test('returns 400 when question is missing', async () => {
    const res = await request(app)
      .post(`/api/courses/${course._id}/qa`)
      .set('Authorization', `Bearer ${token}`)
      .send({ question: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('question is required');
  });
});