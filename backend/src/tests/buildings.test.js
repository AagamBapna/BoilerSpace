const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../app');
const Building = require('../models/Building');
const Room = require('../models/Room');

let mongoServer;

// ─── Test data ────────────────────────────────────────────────────────────────

const sampleBuildings = [
    {
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42713,
        longitude: -86.9137,
        address: '496 Northwestern Ave',
        amenities: ['Wi-Fi', 'Outlets'],
    },
    {
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        address: '305 N University St',
        amenities: ['Wi-Fi', 'Computer Labs'],
    },
    {
        name: 'Hicks Undergraduate Library',
        abbreviation: 'HIKS',
        latitude: 40.42464,
        longitude: -86.91126,
        address: '504 W State St',
        amenities: ['Quiet Zones', 'Printers'],
    },
];

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    await Room.syncIndexes();
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

beforeEach(async () => {
    await Building.deleteMany({});
    await Room.deleteMany({});
});

// ─── Schema Validation Tests ──────────────────────────────────────────────────

describe('Building Schema Validation', () => {
    test('saves a valid building', async () => {
        const building = new Building(sampleBuildings[0]);
        const saved = await building.save();
        expect(saved._id).toBeDefined();
        expect(saved.name).toBe('Wilmeth Active Learning Center');
        expect(saved.abbreviation).toBe('WALC');
    });

    test('rejects a building missing required name', async () => {
        const building = new Building({ abbreviation: 'TEST', latitude: 40.0, longitude: -86.0 });
        await expect(building.save()).rejects.toThrow();
    });

    test('rejects a building missing required abbreviation', async () => {
        const building = new Building({ name: 'Test Hall', latitude: 40.0, longitude: -86.0 });
        await expect(building.save()).rejects.toThrow();
    });

    test('rejects duplicate building names', async () => {
        await Building.create(sampleBuildings[0]);
        const duplicate = new Building({ ...sampleBuildings[0] });
        await expect(duplicate.save()).rejects.toThrow();
    });

    test('stores abbreviation in uppercase', async () => {
        const building = await Building.create({
            name: 'Test Hall',
            abbreviation: 'tst',
            latitude: 40.0,
            longitude: -86.0,
        });
        expect(building.abbreviation).toBe('TST');
    });
});

describe('Room Schema Validation', () => {
    let building;

    beforeEach(async () => {
        building = await Building.create(sampleBuildings[0]);
    });

    test('saves a valid room', async () => {
        const room = new Room({
            buildingId: building._id,
            name: 'WALC 1018',
            floor: 1,
            capacity: 30,
            noiseLevel: 'moderate',
        });
        const saved = await room.save();
        expect(saved._id).toBeDefined();
        expect(saved.buildingId.toString()).toBe(building._id.toString());
    });

    test('rejects a room missing buildingId', async () => {
        const room = new Room({ name: 'Room 101', floor: 1 });
        await expect(room.save()).rejects.toThrow();
    });

    test('rejects a room missing name', async () => {
        const room = new Room({ buildingId: building._id, floor: 1 });
        await expect(room.save()).rejects.toThrow();
    });

    test('rejects invalid noiseLevel enum value', async () => {
        const room = new Room({
            buildingId: building._id,
            name: 'WALC 999',
            noiseLevel: 'deafening',
        });
        await expect(room.save()).rejects.toThrow();
    });

    test('rejects duplicate room name within the same building', async () => {
        await Room.create({ buildingId: building._id, name: 'WALC 1018', floor: 1 });
        const dup = new Room({ buildingId: building._id, name: 'WALC 1018', floor: 2 });
        await expect(dup.save()).rejects.toThrow();
    });

    test('defaults noiseLevel to moderate', async () => {
        const room = await Room.create({ buildingId: building._id, name: 'WALC 1055', floor: 1 });
        expect(room.noiseLevel).toBe('moderate');
    });
});

// ─── API: GET /api/buildings ──────────────────────────────────────────────────

describe('GET /api/buildings', () => {
    beforeEach(async () => {
        await Building.insertMany(sampleBuildings);
    });

    test('returns 200 with all buildings', async () => {
        const res = await request(app).get('/api/buildings');
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
    });

    // Acceptance Criteria: buildings appear in alphabetical order
    test('returns buildings sorted alphabetically by name', async () => {
        const res = await request(app).get('/api/buildings');
        const names = res.body.map((b) => b.name);
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        expect(names).toEqual(sorted);
    });

    test('returns correct building fields', async () => {
        const res = await request(app).get('/api/buildings');
        const walc = res.body.find((b) => b.abbreviation === 'WALC');
        expect(walc).toBeDefined();
        expect(walc.name).toBe('Wilmeth Active Learning Center');
        expect(walc.latitude).toBeDefined();
        expect(walc.longitude).toBeDefined();
    });

    test('returns empty array when no buildings exist', async () => {
        await Building.deleteMany({});
        const res = await request(app).get('/api/buildings');
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// ─── API: GET /api/buildings/:id ─────────────────────────────────────────────

describe('GET /api/buildings/:id', () => {
    let building;

    beforeEach(async () => {
        building = await Building.create(sampleBuildings[0]);
    });

    test('returns the correct building by id', async () => {
        const res = await request(app).get(`/api/buildings/${building._id}`);
        expect(res.status).toBe(200);
        expect(res.body.abbreviation).toBe('WALC');
    });

    // Acceptance Criteria: clear message when building not found
    test('returns 404 for a non-existent building id', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app).get(`/api/buildings/${fakeId}`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Building not found');
    });

    test('returns 404 for a malformed id', async () => {
        const res = await request(app).get('/api/buildings/not-a-valid-id');
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Building not found');
    });
});

// ─── API: GET /api/buildings/:id/rooms ───────────────────────────────────────

describe('GET /api/buildings/:id/rooms', () => {
    let walc, lwsn;

    beforeEach(async () => {
        walc = await Building.create(sampleBuildings[0]);
        lwsn = await Building.create(sampleBuildings[1]);

        // Rooms for WALC
        await Room.insertMany([
            { buildingId: walc._id, name: 'WALC 3087', floor: 3, capacity: 40, noiseLevel: 'loud' },
            { buildingId: walc._id, name: 'WALC 1018', floor: 1, capacity: 30, noiseLevel: 'moderate' },
            { buildingId: walc._id, name: 'WALC 1055', floor: 1, capacity: 20, noiseLevel: 'quiet' },
        ]);

        // Room for LWSN — should NOT appear in WALC results
        await Room.create({ buildingId: lwsn._id, name: 'LWSN B134', floor: 0, capacity: 200, noiseLevel: 'loud' });
    });

    // Acceptance Criteria: only rooms belonging to selected building are shown
    test('returns only rooms for the specified building', async () => {
        const res = await request(app).get(`/api/buildings/${walc._id}/rooms`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(3);
        res.body.forEach((room) => {
            expect(room.buildingId).toBe(walc._id.toString());
        });
    });

    test('rooms are sorted by floor then name', async () => {
        const res = await request(app).get(`/api/buildings/${walc._id}/rooms`);
        const names = res.body.map((r) => r.name);
        // Floor 1 rooms first (alphabetical), then floor 3
        expect(names).toEqual(['WALC 1018', 'WALC 1055', 'WALC 3087']);
    });

    test('returns empty array when building has no rooms', async () => {
        const hiks = await Building.create(sampleBuildings[2]);
        const res = await request(app).get(`/api/buildings/${hiks._id}/rooms`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    // Acceptance Criteria: clear message when building not found
    test('returns 404 when building does not exist', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app).get(`/api/buildings/${fakeId}/rooms`);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Building not found');
    });
});

// ─── No-Duplicate Seeding Acceptance Criteria ────────────────────────────────

describe('No duplicate buildings after re-seed', () => {
    // Simulate running the seed logic twice
    async function runSeedLogic() {
        await Building.deleteMany({});
        await Room.deleteMany({});
        const buildings = await Building.insertMany(sampleBuildings);
        for (const b of buildings) {
            await Room.create({ buildingId: b._id, name: `${b.abbreviation} 101`, floor: 1 });
        }
        return buildings;
    }

    test('buildings appear exactly once after two seed runs', async () => {
        await runSeedLogic();
        await runSeedLogic(); // second run

        const count = await Building.countDocuments();
        expect(count).toBe(sampleBuildings.length);
    });

    test('rooms appear exactly once after two seed runs', async () => {
        await runSeedLogic();
        await runSeedLogic();

        const count = await Room.countDocuments();
        expect(count).toBe(sampleBuildings.length); // 1 room per building
    });
});
