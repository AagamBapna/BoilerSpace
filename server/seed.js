const mongoose = require('mongoose');
require('dotenv').config();

const Building = require('./models/Building');
const Room = require('./models/Room');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/boilerspace';

const buildings = [
    {
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42713,
        longitude: -86.91370,
        address: '496 Northwestern Ave, West Lafayette, IN 47906',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards', 'Cafe', 'Group Rooms'],
    },
    {
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        address: '305 N University St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs', 'Whiteboards'],
    },
    {
        name: 'Hampton Hall of Civil Engineering',
        abbreviation: 'HAMP',
        latitude: 40.42365,
        longitude: -86.91287,
        address: '550 Stadium Mall Dr, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Study Lounges'],
    },
    {
        name: 'Hicks Undergraduate Library',
        abbreviation: 'HIKS',
        latitude: 40.42464,
        longitude: -86.91126,
        address: '504 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Quiet Zones', 'Printers', 'Study Rooms'],
    },
    {
        name: 'Krannert Building',
        abbreviation: 'KRAN',
        latitude: 40.42350,
        longitude: -86.91010,
        address: '403 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Lecture Halls', 'Group Rooms'],
    },
    {
        name: 'Mathematical Sciences Building',
        abbreviation: 'MATH',
        latitude: 40.42382,
        longitude: -86.91606,
        address: '150 N University St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards', 'Study Lounges'],
    },
    {
        name: 'Electrical Engineering Building',
        abbreviation: 'EE',
        latitude: 40.42294,
        longitude: -86.91428,
        address: '465 Northwestern Ave, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs'],
    },
    {
        name: 'Stewart Center',
        abbreviation: 'STEW',
        latitude: 40.42478,
        longitude: -86.91284,
        address: '128 Memorial Mall, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Cafe', 'Auditorium', 'Study Lounges'],
    },
    {
        name: 'Heavilon Hall',
        abbreviation: 'HEAV',
        latitude: 40.42552,
        longitude: -86.91027,
        address: '500 Oval Dr, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Classrooms'],
    },
    {
        name: 'Lilly Hall of Life Sciences',
        abbreviation: 'LILY',
        latitude: 40.42270,
        longitude: -86.91760,
        address: '915 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Study Lounges', 'Labs'],
    },
];

// Pseudo rooms for each building
const roomTemplates = [
    { name: 'Room 1001', floor: 1, capacity: 30, amenities: ['Whiteboard', 'Projector'], noiseLevel: 'moderate' },
    { name: 'Room 1002', floor: 1, capacity: 20, amenities: ['Outlets', 'Whiteboard'], noiseLevel: 'quiet' },
    { name: 'Room 2001', floor: 2, capacity: 50, amenities: ['Projector', 'Outlets', 'Whiteboard'], noiseLevel: 'moderate' },
    { name: 'Room 2002', floor: 2, capacity: 15, amenities: ['Outlets'], noiseLevel: 'quiet' },
    { name: 'Room 3001', floor: 3, capacity: 40, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'loud' },
];

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Building.deleteMany({});
        await Room.deleteMany({});
        console.log('Cleared existing buildings and rooms');

        // Insert buildings
        const createdBuildings = await Building.insertMany(buildings);
        console.log(`Inserted ${createdBuildings.length} buildings`);

        // Insert rooms for each building (pick 3 random rooms per building)
        const allRooms = [];
        for (const building of createdBuildings) {
            const numRooms = 2 + Math.floor(Math.random() * 3); // 2-4 rooms per building
            for (let i = 0; i < numRooms; i++) {
                const template = roomTemplates[i % roomTemplates.length];
                allRooms.push({
                    ...template,
                    buildingId: building._id,
                });
            }
        }
        const createdRooms = await Room.insertMany(allRooms);
        console.log(`Inserted ${createdRooms.length} rooms`);

        console.log('Seed completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    }
}

seed();
