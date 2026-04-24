const passport = require('passport');

// Mock passport.authenticate to inject a test user
jest.spyOn(passport, 'authenticate').mockImplementation(() => (req, res, next) => {
  req.user = { id: 'user-1', email: 'test@purdue.edu', displayName: 'Test User' };
  next();
});

const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../app');
const Announcement = require('../models/Announcement');
const Event = require('../models/Event');
const Club = require('../models/Club');

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

describe('Announcements API', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await Announcement.deleteMany({});
    await Event.deleteMany({});
    await Club.deleteMany({});
    await mongoose.disconnect();
  });

  describe('Announcements for events', () => {
    let club;
    let event;

    beforeAll(async () => {
      club = await Club.create({
        name: 'Announce Club',
        description: 'Club for announcements',
        contactInfo: 'ann@example.com',
        category: 'General',
        organizerIds: ['user-1'],
      });

      event = await Event.create({
        title: 'Announce Event',
        date: '2026-03-10',
        location: 'Auditorium',
        clubId: club._id,
      });
    });

    it('returns 400 when body is missing', async () => {
      const res = await request(app).post(`/api/events/${event._id}/announcements`).send({}).expect(400);
      assert.strictEqual(res.body.error, 'Validation failed');
      assert.ok(res.body.fields?.body);
    });

    it('returns 403 when user is not organizer', async () => {
      club.organizerIds = ['other-user'];
      await club.save();

      const res = await request(app)
        .post(`/api/events/${event._id}/announcements`)
        .send({ body: 'Update' })
        .expect(403);

      assert.strictEqual(res.body.error, 'Forbidden');

      club.organizerIds = ['user-1'];
      await club.save();
    });

    it('creates announcements and returns them in chronological order', async () => {
      // create first
      const res1 = await request(app)
        .post(`/api/events/${event._id}/announcements`)
        .send({ body: 'First update' })
        .expect(201);

      assert.strictEqual(res1.body.body, 'First update');
      assert.ok(res1.body.id);

      // create second
      const res2 = await request(app)
        .post(`/api/events/${event._id}/announcements`)
        .send({ body: 'Second update' })
        .expect(201);

      const list = await request(app).get(`/api/events/${event._id}/announcements`).expect(200);
      assert(Array.isArray(list.body));
      // chronological ascending: first then second
      assert.strictEqual(list.body[0].body, 'First update');
      assert.strictEqual(list.body[1].body, 'Second update');
    });

    it('creates a club-wide announcement when no event is selected', async () => {
      const res = await request(app)
        .post(`/api/events/clubs/${club._id}/announcements`)
        .send({ body: 'Club-wide update' })
        .expect(201);

      assert.strictEqual(res.body.body, 'Club-wide update');
      assert.strictEqual(res.body.eventId, null);
      assert.ok(res.body.clubId);
    });
  });

  describe('Global Broadcasts (Admin)', () => {
    it('rejects post broadcast if user is not admin', async () => {
      const res = await request(app)
        .post('/api/announcements/broadcast')
        .send({ title: 'Test', body: 'Nope', priorityLevel: 'info' })
        .expect(403);
      assert.strictEqual(res.body.error, 'Admin access required');
    });

    it('allows admin to post broadcast', async () => {
      // Mock passport user temporarily has isAdmin true
      jest.spyOn(passport, 'authenticate').mockImplementationOnce(() => (req, res, next) => {
        req.user = { id: 'admin-1', email: 'admin@purdue.edu', displayName: 'Admin User', isAdmin: true };
        next();
      });

      const res = await request(app)
        .post('/api/announcements/broadcast')
        .send({ title: 'Test Admin', body: 'Global Message', priorityLevel: 'alert' })
        .expect(201);

      assert.strictEqual(res.body.title, 'Test Admin');
      assert.strictEqual(res.body.body, 'Global Message');
      assert.strictEqual(res.body.priorityLevel, 'alert');
      assert.strictEqual(res.body.type, 'global');
    });
  });
});
