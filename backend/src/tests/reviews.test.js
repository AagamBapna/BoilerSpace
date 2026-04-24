const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Building = require('../models/Building');
const Room = require('../models/Room');
const Review = require('../models/Review');
const { signToken } = require('../config/jwt');

let mongoServer;
let user, token, building, room, room2;

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
    await Building.deleteMany({});
    await Room.deleteMany({});
    await Review.deleteMany({});

    user = await User.create({
        email: 'test@purdue.edu',
        password: 'password123',
        displayName: 'TestUser',
        major: 'Computer Science',
        year: 'Senior',
    });
    token = signToken(user);

    building = await Building.create({
        name: 'Test Building',
        abbreviation: 'TEST',
        latitude: 40.0,
        longitude: -86.0,
    });

    room = await Room.create({
        buildingId: building._id,
        name: 'Room 101',
    });

    room2 = await Room.create({
        buildingId: building._id,
        name: 'Room 102',
    });
});

describe('POST /api/reviews', () => {
    it('should create a new review successfully', async () => {
        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', `Bearer ${token}`)
            .send({
                rating: 4,
                comment: 'Great quiet place!',
                roomId: room._id,
            });

        expect(res.status).toBe(201);
        expect(res.body.rating).toBe(4);
        expect(res.body.comment).toBe('Great quiet place!');
        expect(res.body.roomId.toString()).toBe(room._id.toString());
        expect(res.body.userId.displayName).toBe('TestUser');
    });

    it('should reject a review without auth', async () => {
        const res = await request(app)
            .post('/api/reviews')
            .send({ rating: 4, comment: 'Nice', roomId: room._id });
        expect(res.status).toBe(401);
    });

    it('should reject a rating less than 1', async () => {
        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', `Bearer ${token}`)
            .send({ rating: 0, comment: 'Terrible', roomId: room._id });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Rating must be at least 1');
    });

    it('should reject a rating greater than 5', async () => {
        const res = await request(app)
            .post('/api/reviews')
            .set('Authorization', `Bearer ${token}`)
            .send({ rating: 6, comment: 'Amazing', roomId: room._id });
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Rating cannot exceed 5');
    });
});

describe('GET /api/reviews/:roomId', () => {
    beforeEach(async () => {
        await Review.create({ rating: 4, comment: 'Nice', roomId: room._id, userId: user._id });
        await Review.create({ rating: 5, comment: 'Love it', roomId: room._id, userId: user._id });

        // Review for a different room to ensure query isolation
        await Review.create({ rating: 1, comment: 'Bad', roomId: room2._id, userId: user._id });
    });

    it('should return correct reviews limit and average for the specific room', async () => {
        const res = await request(app).get(`/api/reviews/${room._id}`);
        expect(res.status).toBe(200);
        expect(res.body.reviews).toHaveLength(2);

        // (4 + 5) / 2 = 4.5
        expect(res.body.averageRating).toBe(4.5);
        expect(res.body.totalReviews).toBe(2);
    });

    it('should return reviews in descending order (newest first)', async () => {
        // Create an older review manually by manipulating timestamps or just creating in sequence
        // Since we created two reviews in beforeEach, let's create a third one now
        await Review.create({ 
            rating: 2, 
            comment: 'Oldest', 
            roomId: room._id, 
            userId: user._id,
            createdAt: new Date(Date.now() - 10000) // 10 seconds ago
        });
        
        const latestComment = 'Just posted now!';
        await request(app)
            .post('/api/reviews')
            .set('Authorization', `Bearer ${token}`)
            .send({ rating: 5, comment: latestComment, roomId: room._id });

        const res = await request(app).get(`/api/reviews/${room._id}`);
        expect(res.status).toBe(200);
        // The one we just POSTed should be first in the array
        expect(res.body.reviews[0].comment).toBe(latestComment);
        // The one we created with an older date should be last
        expect(res.body.reviews[res.body.reviews.length - 1].comment).toBe('Oldest');
    });
});
