
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

  describe('Recurring events', () => {
    let club;

    beforeAll(async () => {
      club = await Club.findOne({ name: 'CS Club' });
    });

    it('creates a weekly recurring series with linked recurrenceGroupId', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({
          title: 'Weekly Standup',
          description: 'Club planning sync',
          date: '2026-04-01',
          time: '18:00',
          location: 'LWSN',
          clubId: club._id.toString(),
          recurrence: {
            type: 'weekly',
            dayOfWeek: 3,
            endDate: '2026-04-29',
          },
        })
        .expect(201);

      assert(Array.isArray(res.body));
      assert.strictEqual(res.body.length, 5);
      const groupIds = [...new Set(res.body.map((event) => event.recurrence?.recurrenceGroupId))];
      assert.strictEqual(groupIds.length, 1);
      assert.ok(groupIds[0]);
      assert.strictEqual(res.body[0].recurrence.type, 'weekly');
    });

    it('creates weekly recurring events on the selected weekday', async () => {
      const res = await request(app)
        .post('/api/events')
        .send({
          title: 'Friday Study Group',
          description: 'Weekly Friday session',
          date: '2026-04-01',
          time: '19:00',
          location: 'LWSN',
          clubId: club._id.toString(),
          recurrence: {
            type: 'weekly',
            dayOfWeek: 5,
            endDate: '2026-04-29',
          },
        })
        .expect(201);

      assert(Array.isArray(res.body));
      assert.strictEqual(res.body.length, 4);
      assert.strictEqual(res.body[0].date, '2026-04-03');
      assert.strictEqual(res.body[0].recurrence.dayOfWeek, 5);
    });

    it('updates only a single recurring instance when scope=single', async () => {
      const event = await Event.findOne({ title: 'Weekly Standup', date: '2026-04-08' });
      const seriesCount = await Event.countDocuments({ 'recurrence.recurrenceGroupId': event.recurrence.recurrenceGroupId });

      const res = await request(app)
        .patch(`/api/events/${event._id}?scope=single`)
        .send({ title: 'Weekly Standup (Special Topic)' })
        .expect(200);

      assert.strictEqual(res.body.updatedCount, 1);
      const refreshed = await Event.findById(event._id);
      assert.strictEqual(refreshed.title, 'Weekly Standup (Special Topic)');

      const unchangedCount = await Event.countDocuments({
        'recurrence.recurrenceGroupId': event.recurrence.recurrenceGroupId,
        title: 'Weekly Standup',
      });
      assert.strictEqual(unchangedCount, seriesCount - 1);
    });

    it('moves only one recurring instance date when scope=single', async () => {
      const event = await Event.findOne({ title: 'Weekly Standup', date: '2026-04-08' });
      const groupId = event.recurrence.recurrenceGroupId;

      const res = await request(app)
        .patch(`/api/events/${event._id}?scope=single`)
        .send({
          date: '2026-04-09',
          recurrence: {
            type: 'weekly',
            dayOfWeek: 3,
            endDate: '2026-04-29',
          },
        })
        .expect(200);

      assert.strictEqual(res.body.updatedCount, 1);

      const moved = await Event.findById(event._id);
      assert.strictEqual(moved.date, '2026-04-09');
      assert.strictEqual(moved.recurrence.dayOfWeek, 3);

      const siblings = await Event.find({ 'recurrence.recurrenceGroupId': groupId, _id: { $ne: event._id } });
      assert(siblings.every((entry) => entry.date !== '2026-04-09'));
      assert(siblings.every((entry) => entry.recurrence.dayOfWeek === 3));
    });

    it('updates an entire recurring series when scope=all', async () => {
      const event = await Event.findOne({ title: 'Weekly Standup' });

      const res = await request(app)
        .patch(`/api/events/${event._id}?scope=all`)
        .send({ location: 'WALC' })
        .expect(200);

      const seriesEvents = await Event.find({ 'recurrence.recurrenceGroupId': event.recurrence.recurrenceGroupId });
      assert.strictEqual(res.body.updatedCount, seriesEvents.length);
      assert(seriesEvents.every((entry) => entry.location === 'WALC'));
    });

    it('shifts recurring dates by offset when scope=all updates date', async () => {
      const event = await Event.findOne({ title: 'Weekly Standup' }).sort({ date: 1 });

      const res = await request(app)
        .patch(`/api/events/${event._id}?scope=all`)
        .send({ date: '2026-04-03' })
        .expect(200);

      const seriesEvents = await Event.find({ 'recurrence.recurrenceGroupId': event.recurrence.recurrenceGroupId }).sort({ date: 1 });
      assert.strictEqual(res.body.updatedCount, seriesEvents.length);
      const shiftedDates = seriesEvents.map((entry) => entry.date);
      assert.deepStrictEqual(shiftedDates, ['2026-04-03', '2026-04-10', '2026-04-17', '2026-04-24', '2026-05-01']);
    });

    it('deletes future recurring instances when scope=future', async () => {
      const event = await Event.findOne({ 'recurrence.type': 'weekly' }).sort({ date: 1 });

      const res = await request(app)
        .delete(`/api/events/${event._id}?scope=future`)
        .expect(200);

      assert.ok(res.body.deletedCount >= 1);
      const remaining = await Event.countDocuments({ 'recurrence.recurrenceGroupId': event.recurrence.recurrenceGroupId });
      assert.strictEqual(remaining, 0);
    });
  });
});