const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
jest.mock('../config/gcs', () => ({
    bucket: { name: 'test', file: () => ({ createWriteStream: () => {}, delete: () => Promise.resolve() }) },
}));
const app = require('../app');
const Building = require('../models/Building');

let mongoServer;

jest.setTimeout(60000);

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {
        serverSelectionTimeoutMS: 60000,
        connectTimeoutMS: 60000,
    });
});

afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
        await mongoServer.stop();
    }
});

beforeEach(async () => {
    await Building.deleteMany({});
    await Building.create([
        { name: 'Lawson', abbreviation: 'LWSN', latitude: 40.4278, longitude: -86.9169, address: '305 N University' },
        { name: 'Wilmeth Active Learning Center', abbreviation: 'WALC', latitude: 40.4274, longitude: -86.9127, address: '203 N Russel' },
        { name: 'Stewart Center', abbreviation: 'STEW', latitude: 40.4249, longitude: -86.9125, address: '128 Memorial Mall' },
    ]);
});

describe('GET /api/buildings/nearby', () => {
    test('returns 400 without lat/lon', async () => {
        const res = await request(app).get('/api/buildings/nearby');
        expect(res.status).toBe(400);
    });
    test('returns buildings sorted by distance', async () => {
        const res = await request(app).get('/api/buildings/nearby?lat=40.4278&lon=-86.9169');
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(3);
        expect(res.body[0].abbreviation).toBe('LWSN');
        expect(res.body[0].distance).toBeDefined();
        expect(res.body[0].distance).toBeLessThan(res.body[1].distance);
    });
    test('includes distance field in miles', async () => {
        const res = await request(app).get('/api/buildings/nearby?lat=40.4237&lon=-86.9212');
        expect(res.status).toBe(200);
        res.body.forEach(b => {
            expect(typeof b.distance).toBe('number');
            expect(b.distance).toBeGreaterThanOrEqual(0);
        });
    });
});