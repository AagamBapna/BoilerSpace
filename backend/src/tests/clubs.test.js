
const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../app');
const Club = require('../models/Club');

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

describe('Clubs API', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await Club.deleteMany({});
    await mongoose.disconnect();
  });


  describe('POST /api/clubs', () => {
    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/clubs')
        .send({ organizerIds: ['user-1'] })
        .expect(400);
      assert.strictEqual(res.body.error, 'Validation failed');
      assert.ok(res.body.fields?.name);
    });

    it('returns 400 when organizerId is missing', async () => {
      const res = await request(app)
        .post('/api/clubs')
        .send({ name: 'Test Club' })
        .expect(400);
      assert.strictEqual(res.body.error, 'Validation failed');
      assert.ok(res.body.fields?.organizerIds);
    });

    it('creates a club and returns 201 with club data', async () => {
      const res = await request(app)
        .post('/api/clubs')
        .send({
          name: 'CS Club',
          description: 'Computer science',
          contactInfo: 'cs@example.com',
          category: 'Academic',
          organizerIds: ['user-1'],
        })
        .expect(201);
      assert.strictEqual(res.body.name, 'CS Club');
      assert.strictEqual(res.body.description, 'Computer science');
      assert.deepStrictEqual(res.body.organizerIds, ['user-1']);
      assert.ok(res.body.id);
    });
  });

  describe('GET /api/clubs', () => {
    it('returns 200 and array of clubs', async () => {
      const res = await request(app).get('/api/clubs').expect(200);
      assert(Array.isArray(res.body));
      assert(res.body.length >= 1);
      assert.ok(res.body[0].id);
      assert.ok(res.body[0].name);
    });
  });

  describe('GET /api/clubs/:id', () => {
    it('returns 404 for invalid id', async () => {
      await request(app)
        .get('/api/clubs/507f1f77bcf86cd799439011')
        .expect(404);
    });

    it('returns 200 and club when id exists', async () => {
      const club = await Club.findOne({ name: 'CS Club' });
      const res = await request(app).get(`/api/clubs/${club._id}`).expect(200);
      assert.strictEqual(res.body.name, 'CS Club');
      assert.strictEqual(res.body.id, club._id.toString());
    });
  });

  describe('PATCH /api/clubs/:id', () => {
    it('returns 403 when X-User-Id does not match organizer', async () => {
      const club = await Club.findOne({ name: 'CS Club' });
      const res = await request(app)
        .patch(`/api/clubs/${club._id}`)
        .set('X-User-Id', 'other-user')
        .send({ name: 'Hacked' })
        .expect(403);
      assert.strictEqual(res.body.error, 'Forbidden');
      assert.ok(res.body.message.includes('permission'));
    });

    it('returns 200 and updates club when X-User-Id matches organizer', async () => {
      const club = await Club.findOne({ name: 'CS Club' });
      const res = await request(app)
        .patch(`/api/clubs/${club._id}`)
        .set('X-User-Id', 'user-1')
        .send({ description: 'Updated description' })
        .expect(200);
      assert.strictEqual(res.body.description, 'Updated description');
    });
  });
});