
const passport = require('passport');

let mockedUserId = 'user-1';
jest.spyOn(passport, 'authenticate').mockImplementation(() => (req, res, next) => {
  req.user = { id: mockedUserId, _id: mockedUserId, email: 'test@purdue.edu' };
  next();
});

const assert = require('node:assert');
const mongoose = require('mongoose');
const request = require('supertest');

const app = require('../app');
const Club = require('../models/Club');
const ClubMember = require('../models/ClubMember');
const User = require('../models/User');

const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

jest.setTimeout(60000);

describe('Clubs API', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Club.deleteMany({});
    await ClubMember.deleteMany({});
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
        .send({
          name: 'Test Club',
          description: 'Test description',
          contactInfo: 'test@purdue.edu',
          category: 'Academic',
        })
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
      assert.ok(Array.isArray(res.body.allowedPositions));
      assert.ok(res.body.allowedPositions.includes('Member'));
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
    it('returns 401 when X-User-Id is missing', async () => {
      const club = await Club.findOne({ name: 'CS Club' });
      const res = await request(app)
        .patch(`/api/clubs/${club._id}`)
        .send({ name: 'Attempt Without Auth' })
        .expect(401);
      assert.strictEqual(res.body.error, 'Unauthorized');
      assert.ok(res.body.message.includes('Authentication'));
    });

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

  describe('Organizer dashboard APIs', () => {
    let club;
    let member;
    let organizerCandidate;
    let officer;

    beforeAll(async () => {
      club = await Club.findOne({ name: 'CS Club' });

      member = await User.create({
        email: 'member@example.com',
        password: 'password123',
        displayName: 'Member User',
        major: 'CS',
        year: 'Senior',
        clubIds: [club._id.toString()],
      });

      organizerCandidate = await User.create({
        email: 'neworg@example.com',
        password: 'password123',
        displayName: 'Future Organizer',
        major: 'ECE',
        year: 'Junior',
        clubIds: [club._id.toString()],
      });

      officer = await User.create({
        email: 'officer@example.com',
        password: 'password123',
        displayName: 'Officer User',
        major: 'CS',
        year: 'Junior',
        clubIds: [club._id.toString()],
      });

      await ClubMember.create({
        clubId: club._id,
        userId: officer._id.toString(),
        role: 'officer',
        position: 'Member',
      });
    });

    it('lists members for organizer', async () => {
      mockedUserId = 'user-1';
      const res = await request(app)
        .get(`/api/clubs/${club._id}/members`)
        .expect(200);

      assert(Array.isArray(res.body));
      assert.ok(res.body.find((u) => u.id === member._id.toString()));
    });

    it('adds a new organizer', async () => {
      mockedUserId = 'user-1';
      const res = await request(app)
        .post(`/api/clubs/${club._id}/organizers`)
        .send({ userId: organizerCandidate._id.toString() })
        .expect(201);

      assert.strictEqual(res.body.success, true);

      const updatedClub = await Club.findById(club._id);
      assert.ok(updatedClub.organizerIds.map(String).includes(organizerCandidate._id.toString()));
    });

    it('demotes an organizer to member', async () => {
      mockedUserId = 'user-1';

      await request(app)
        .post(`/api/clubs/${club._id}/organizers`)
        .send({ userId: organizerCandidate._id.toString() })
        .expect(201);

      const res = await request(app)
        .delete(`/api/clubs/${club._id}/organizers/${organizerCandidate._id}`)
        .expect(200);

      assert.strictEqual(res.body.success, true);

      const updatedClub = await Club.findById(club._id);
      assert.ok(!updatedClub.organizerIds.map(String).includes(organizerCandidate._id.toString()));
    });

    it('shows and approves pending requests', async () => {
      const pendingUser = await User.create({
        email: 'pending@example.com',
        password: 'password123',
        displayName: 'Pending User',
        major: 'CS',
        year: 'Sophomore',
        pendingClubIds: [club._id.toString()],
      });

      mockedUserId = 'user-1';
      const pendingRes = await request(app)
        .get(`/api/clubs/${club._id}/pending-members`)
        .expect(200);

      assert.ok(pendingRes.body.find((u) => u.id === pendingUser._id.toString()));

      const approveRes = await request(app)
        .post(`/api/clubs/${club._id}/members/${pendingUser._id}/approve`)
        .expect(200);

      assert.strictEqual(approveRes.body.success, true);

      const updatedUser = await User.findById(pendingUser._id);
      assert.ok(updatedUser.clubIds.map(String).includes(club._id.toString()));
      assert.ok(!updatedUser.pendingClubIds.map(String).includes(club._id.toString()));
    });

    it('prevents demoting the last organizer', async () => {
      mockedUserId = 'user-1';
      const res = await request(app)
        .delete(`/api/clubs/${club._id}/organizers/user-1`)
        .expect(400);

      assert.strictEqual(res.body.error, 'Validation failed');
      assert.ok(res.body.message.includes('At least one organizer'));
    });

    it('prevents non-organizers from using organizer APIs', async () => {
      mockedUserId = member._id.toString();
      const res = await request(app)
        .post(`/api/clubs/${club._id}/organizers`)
        .send({ userId: member._id.toString() })
        .expect(403);

      assert.strictEqual(res.body.error, 'Forbidden');
    });

    it('kicks a member from the club', async () => {
      mockedUserId = 'user-1';
      await request(app)
        .delete(`/api/clubs/${club._id}/members/${member._id}`)
        .expect(200);

      const updatedMember = await User.findById(member._id);
      assert.ok(!updatedMember.clubIds.map(String).includes(club._id.toString()));
    });

    it('creates, renames, and lists custom positions for admins', async () => {
      mockedUserId = 'user-1';

      const createRes = await request(app)
        .post(`/api/clubs/${club._id}/positions`)
        .send({ name: 'Treasurer' })
        .expect(201);
      assert.ok(createRes.body.positions.includes('Treasurer'));

      const renameRes = await request(app)
        .patch(`/api/clubs/${club._id}/positions/Treasurer`)
        .send({ name: 'Finance Lead' })
        .expect(200);
      assert.ok(renameRes.body.positions.includes('Finance Lead'));

      const listRes = await request(app)
        .get(`/api/clubs/${club._id}/positions`)
        .expect(200);
      assert.ok(listRes.body.positions.includes('Member'));
      assert.ok(listRes.body.positions.includes('Finance Lead'));
    }, 15000);

    it('prevents non-admin from managing custom positions', async () => {
      mockedUserId = officer._id.toString();
      const res = await request(app)
        .post(`/api/clubs/${club._id}/positions`)
        .send({ name: 'Event Lead' })
        .expect(403);

      assert.strictEqual(res.body.error, 'Forbidden');
    });

    it('updates member role and position via role endpoint', async () => {
      mockedUserId = 'user-1';

      const createPositionRes = await request(app)
        .post(`/api/clubs/${club._id}/positions`)
        .send({ name: 'Event Lead' });
      assert.ok([200, 201, 400].includes(createPositionRes.statusCode));

      const roleRes = await request(app)
        .patch(`/api/clubs/${club._id}/members/${officer._id}/role`)
        .send({ role: 'member', position: 'Event Lead' })
        .expect(200);

      assert.strictEqual(roleRes.body.success, true);
      assert.strictEqual(roleRes.body.member.role, 'member');
      assert.strictEqual(roleRes.body.member.position, 'Event Lead');

      const membership = await ClubMember.findOne({ clubId: club._id, userId: officer._id.toString() });
      assert.strictEqual(membership.role, 'member');
      assert.strictEqual(membership.position, 'Event Lead');
    });

    it('prevents assigning invalid positions', async () => {
      mockedUserId = 'user-1';

      const res = await request(app)
        .patch(`/api/clubs/${club._id}/members/${officer._id}/role`)
        .send({ position: 'NotARealPosition' })
        .expect(400);

      assert.strictEqual(res.body.error, 'Validation failed');
    });

    it('prevents officers from assigning roles above their permissions', async () => {
      mockedUserId = officer._id.toString();

      const res = await request(app)
        .patch(`/api/clubs/${club._id}/members/${organizerCandidate._id}/role`)
        .send({ role: 'admin' })
        .expect(403);

      assert.strictEqual(res.body.error, 'Forbidden');
    });

    it('prevents non-admin users from changing their own role', async () => {
      mockedUserId = officer._id.toString();

      const selfRes = await request(app)
        .patch(`/api/clubs/${club._id}/members/${officer._id}/role`)
        .send({ role: 'member' })
        .expect(403);

      assert.strictEqual(selfRes.body.error, 'Forbidden');
    });
  });

  describe('POST /api/clubs/:id/join', () => {
    let club;
    let joiner;

    beforeAll(async () => {
      club = await Club.findOne({ name: 'CS Club' });
      joiner = await User.create({
        email: 'joiner@example.com',
        password: 'password123',
        displayName: 'Joiner User',
        major: 'CS',
        year: 'Junior',
        clubIds: [],
      });
    });

    it('adds club to user memberships when joining', async () => {
      mockedUserId = joiner._id.toString();

      const res = await request(app)
        .post(`/api/clubs/${club._id}/join`)
        .expect(201);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.alreadyMember, false);
      assert.strictEqual(res.body.pendingRequest, true);

      const updated = await User.findById(joiner._id);
      assert.ok(updated.pendingClubIds.map(String).includes(club._id.toString()));
      assert.ok(!updated.clubIds.map(String).includes(club._id.toString()));
    });

    it('is idempotent when user already joined', async () => {
      mockedUserId = joiner._id.toString();

      const res = await request(app)
        .post(`/api/clubs/${club._id}/join`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.alreadyPending, true);
    });

    it('cancels a pending request when leaving', async () => {
      mockedUserId = joiner._id.toString();

      const res = await request(app)
        .post(`/api/clubs/${club._id}/leave`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.cancelledRequest, true);

      const updated = await User.findById(joiner._id);
      assert.ok(!updated.pendingClubIds.map(String).includes(club._id.toString()));
    });

    it('removes club from memberships when leaving', async () => {
      mockedUserId = joiner._id.toString();

      await User.findByIdAndUpdate(joiner._id, { clubIds: [club._id.toString()] });

      const res = await request(app)
        .post(`/api/clubs/${club._id}/leave`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.alreadyLeft, false);

      const updated = await User.findById(joiner._id);
      assert.ok(!updated.clubIds.map(String).includes(club._id.toString()));
    });

    it('is idempotent when user already left', async () => {
      mockedUserId = joiner._id.toString();

      const res = await request(app)
        .post(`/api/clubs/${club._id}/leave`)
        .expect(200);

      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.alreadyLeft, true);
    });
  });
});