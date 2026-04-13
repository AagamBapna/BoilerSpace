const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const User = require('../models/User');
const Friendship = require('../models/Friendship');

let mongoServer;
let token1, token2;
let user1, user2Public, user3Private;

const reqUser1 = { email: 'user1@purdue.edu', password: 'password123', displayName: 'User One', major: 'CS', year: 'Freshman' };
const reqUser2 = { email: 'user2@purdue.edu', password: 'password123', displayName: 'User Two', major: 'Math', year: 'Sophomore', profileVisibility: 'public', bio: 'Hello' };
const reqUser3 = { email: 'user3@purdue.edu', password: 'password123', displayName: 'User Three', major: 'Physics', year: 'Junior', profileVisibility: 'private', bio: 'Secret' };

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
    await Friendship.deleteMany({});

    // Register users
    await request(app).post('/api/auth/register').send(reqUser1);
    await request(app).post('/api/auth/register').send(reqUser2);
    await request(app).post('/api/auth/register').send(reqUser3);

    // Login users to get tokens
    const login1 = await request(app).post('/api/auth/login').send({ email: reqUser1.email, password: reqUser1.password });
    token1 = login1.body.token;
    user1 = login1.body.user;

    const login2 = await request(app).post('/api/auth/login').send({ email: reqUser2.email, password: reqUser2.password });
    token2 = login2.body.token;
    
    // update privacy/bio for user 2 and 3 since register  not support all fields
    await User.findByIdAndUpdate(login2.body.user.id, { profileVisibility: 'public', bio: 'Hello' });
    user2Public = await User.findById(login2.body.user.id);

    const login3 = await request(app).post('/api/auth/login').send({ email: reqUser3.email, password: reqUser3.password });
    await User.findByIdAndUpdate(login3.body.user.id, { profileVisibility: 'private', bio: 'Secret' });
    user3Private = await User.findById(login3.body.user.id);
});

describe('GET /api/users/:id - Public Profile Views & Privacy', () => {
    test('Self-view returns full profile', async () => {
        const res = await request(app)
            .get(`/api/users/${user1.id}`)
            .set('Authorization', `Bearer ${token1}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(reqUser1.email);
        expect(res.body.notificationPreferences).toBeDefined();
    });

    test('Viewing public profile of another user returns public fields only + connectionStatus', async () => {
        const res = await request(app)
            .get(`/api/users/${user2Public._id}`)
            .set('Authorization', `Bearer ${token1}`);

        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe(user2Public.displayName);
        expect(res.body.bio).toBe('Hello');
        expect(res.body.email).toBeUndefined();
        expect(res.body.notificationPreferences).toBeUndefined();
        expect(res.body.connectionStatus).toBe('none');
        expect(res.body.friendshipId).toBeNull();
    });

    test('Viewing private profile of non-friend returns minimal info', async () => {
        const res = await request(app)
            .get(`/api/users/${user3Private._id}`)
            .set('Authorization', `Bearer ${token1}`);

        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe(user3Private.displayName);
        expect(res.body.profileVisibility).toBe('private');
        expect(res.body.major).toBeUndefined();
        expect(res.body.bio).toBeUndefined();
        expect(res.body.email).toBeUndefined();
        expect(res.body.connectionStatus).toBe('none');
    });

    test('Viewing private profile of a friend returns public fields', async () => {
        // Make them friends
        const friendship = new Friendship({ requester: user1.id, recipient: user3Private._id, status: 'accepted' });
        await friendship.save();

        const res = await request(app)
            .get(`/api/users/${user3Private._id}`)
            .set('Authorization', `Bearer ${token1}`);

        expect(res.status).toBe(200);
        expect(res.body.displayName).toBe(user3Private.displayName);
        expect(res.body.bio).toBe('Secret'); // Public field available to friends
        expect(res.body.email).toBeUndefined();
        expect(res.body.connectionStatus).toBe('accepted');
        expect(res.body.friendshipId).toBe(friendship._id.toString());
    });

    test('Viewing profile with pending outgoing request', async () => {
        const friendship = new Friendship({ requester: user1.id, recipient: user2Public._id, status: 'pending' });
        await friendship.save();

        const res = await request(app)
            .get(`/api/users/${user2Public._id}`)
            .set('Authorization', `Bearer ${token1}`);

        expect(res.status).toBe(200);
        expect(res.body.connectionStatus).toBe('pending_outgoing');
        expect(res.body.friendshipId).toBe(friendship._id.toString());
    });

    test('Viewing profile with pending incoming request', async () => {
        const friendship = new Friendship({ requester: user2Public._id, recipient: user1.id, status: 'pending' });
        await friendship.save();

        const res = await request(app)
            .get(`/api/users/${user2Public._id}`)
            .set('Authorization', `Bearer ${token1}`);

        expect(res.status).toBe(200);
        expect(res.body.connectionStatus).toBe('pending_incoming');
        expect(res.body.friendshipId).toBe(friendship._id.toString());
    });
});
