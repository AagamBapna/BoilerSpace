
const passport = require('passport');

// Mock only `passport.authenticate`
jest.spyOn(passport, 'authenticate').mockImplementation(() => (req, res, next) => {
  req.user = { id: 'user-1', email: 'test@purdue.edu', name: 'Test User' };
  next();
});

const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../app');
const Event = require('../models/Event');
const Club = require('../models/Club');

const { MongoMemoryServer } = require('mongodb-memory-server');




let mongoServer;

describe('Events API', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await Event.deleteMany({});
    await Club.deleteMany({});
    await mongoose.disconnect();
  });

  describe('POST /api/events', () => {
    let club;

    beforeAll(async () => {
      // Create a club to attach events to
      club = await Club.create({
        name: 'CS Club',
        description: 'Computer Science',
        contactInfo: 'cs@example.com',
        category: 'Academic',
        organizerIds: ['user-1'], // matches mocked user
      });
    });

    it('returns 400 when title is missing', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({ date: '2026-03-01', location: 'Hall', clubId: club._id.toString() })
        .expect(400);
      assert.strictEqual(res.body.error, 'Validation failed');
      assert.ok(res.body.fields?.title);
    });

    it('returns 400 when date is missing', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({
          title: 'Event1',
          description: 'Desc',
          time: '10:00',
          location: 'Hall',
          clubId: club._id.toString(),
        })
        .expect(400);
      assert.strictEqual(res.body.error, 'Validation failed');
      assert.ok(res.body.fields?.date);
    });

    it('returns 400 when description is missing', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({ title: 'Event1', date: '2026-03-01', time: '10:00', location: 'Hall', clubId: club._id.toString() })
        .expect(400);
      assert.strictEqual(res.body.error, 'Validation failed');
      assert.ok(res.body.fields?.description);
    });

    it('returns 400 when time is missing', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({ title: 'Event1', description: 'Desc', date: '2026-03-01', location: 'Hall', clubId: club._id.toString() })
        .expect(400);
      assert.strictEqual(res.body.error, 'Validation failed');
      assert.ok(res.body.fields?.time);
    });

    it('returns 403 when user is not organizer', async () => {
      // Temporarily change club organizer to simulate forbidden
      club.organizerIds = ['other-user'];
      await club.save();

      const res = await request(app)
        .post('/api/events')
        .send({
          title: 'Event1',
          description: 'Forbidden test event',
          date: '2026-03-01',
          time: '10:00',
          location: 'Hall',
          clubId: club._id.toString(),
        })
        .expect(403);
      assert.strictEqual(res.body.error, 'Forbidden');
      assert.ok(res.body.message.includes('permission'));

      // Restore organizer for other tests
      club.organizerIds = ['user-1'];
      await club.save();
    });

    it('creates an event and returns 201 with event data', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({
          title: 'Event1',
          description: 'Test event',
          date: '2026-03-01',
          time: '10:00',
          location: 'Hall',
          clubId: club._id.toString(),
        })
        .expect(201);

      assert.strictEqual(res.body.title, 'Event1');
      assert.strictEqual(res.body.description, 'Test event');
      assert.strictEqual(res.body.clubId, club._id.toString());
      assert.ok(res.body.id);
    });
  });

  describe('GET /api/events', () => {
    it('returns 200 and array of events', async () => {
      const res = await request(app).get('/api/events').expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.length >= 1);
      assert.ok(res.body[0].id);
      assert.ok(res.body[0].title);
    });
  });

  describe('GET /api/events/:id', () => {
    it('returns 404 for invalid id', async () => {
      await request(app).get('/api/events/507f1f77bcf86cd799439011').expect(404);
    });

    it('returns 200 and event when id exists', async () => {
      const event = await Event.findOne({ title: 'Event1' });
      const res = await request(app).get(`/api/events/${event._id}`).expect(200);
      assert.strictEqual(res.body.title, 'Event1');
      assert.strictEqual(res.body.id, event._id.toString());
      assert.strictEqual(res.body.clubId, event.clubId.toString());
    });
  });
});