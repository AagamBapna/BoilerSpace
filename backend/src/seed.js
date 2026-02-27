require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('./models/Building');
const Room = require('./models/Room');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/boilerspace';

const buildingsData = [
    {
        name: 'Electrical Engineering Building',
        abbreviation: 'EE',
        latitude: 40.42294,
        longitude: -86.91428,
        address: '465 Northwestern Ave, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs'],
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
        name: 'Heavilon Hall',
        abbreviation: 'HEAV',
        latitude: 40.42552,
        longitude: -86.91027,
        address: '500 Oval Dr, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Classrooms'],
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
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        address: '305 N University St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs', 'Whiteboards'],
    },
    {
        name: 'Lilly Hall of Life Sciences',
        abbreviation: 'LILY',
        latitude: 40.42270,
        longitude: -86.91760,
        address: '915 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Study Lounges', 'Labs'],
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
        name: 'Stewart Center',
        abbreviation: 'STEW',
        latitude: 40.42478,
        longitude: -86.91284,
        address: '128 Memorial Mall, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Cafe', 'Auditorium', 'Study Lounges'],
    },
    {
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42713,
        longitude: -86.91370,
        address: '496 Northwestern Ave, West Lafayette, IN 47906',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards', 'Cafe', 'Group Rooms'],
    },
];

// Rooms keyed by building abbreviation
const roomsData = {
    EE: [
        { name: 'EE 117',  floor: 1, capacity: 200, amenities: ['Projector', 'Outlets'],            noiseLevel: 'loud'     },
        { name: 'EE 207',  floor: 2, capacity: 40,  amenities: ['Outlets', 'Whiteboard'],           noiseLevel: 'moderate' },
        { name: 'EE 309',  floor: 3, capacity: 25,  amenities: ['Whiteboard'],                      noiseLevel: 'quiet'    },
    ],
    HAMP: [
        { name: 'HAMP 1231', floor: 1, capacity: 60, amenities: ['Projector'],                      noiseLevel: 'moderate' },
        { name: 'HAMP 2201', floor: 2, capacity: 25, amenities: ['Outlets', 'Whiteboard'],           noiseLevel: 'quiet'    },
    ],
    HEAV: [
        { name: 'HEAV 226',  floor: 2, capacity: 35, amenities: ['Projector'],                      noiseLevel: 'moderate' },
        { name: 'HEAV 331',  floor: 3, capacity: 25, amenities: ['Whiteboard'],                     noiseLevel: 'quiet'    },
    ],
    HIKS: [
        { name: 'HIKS Study Room A', floor: 1, capacity: 8,   amenities: ['Whiteboard'],            noiseLevel: 'quiet'    },
        { name: 'HIKS Study Room B', floor: 1, capacity: 8,   amenities: ['Whiteboard'],            noiseLevel: 'quiet'    },
        { name: 'HIKS Open Area',    floor: 2, capacity: 100, amenities: ['Outlets', 'Printers'],   noiseLevel: 'moderate' },
    ],
    KRAN: [
        { name: 'KRAN G001', floor: 0, capacity: 80, amenities: ['Projector', 'Outlets'],           noiseLevel: 'loud'     },
        { name: 'KRAN 105',  floor: 1, capacity: 35, amenities: ['Whiteboard', 'Outlets'],          noiseLevel: 'moderate' },
    ],
    LWSN: [
        { name: 'LWSN B134', floor: 0, capacity: 200, amenities: ['Projector', 'Outlets'],          noiseLevel: 'loud'     },
        { name: 'LWSN 1106', floor: 1, capacity: 45,  amenities: ['Whiteboard', 'Outlets'],         noiseLevel: 'moderate' },
        { name: 'LWSN 3102', floor: 3, capacity: 30,  amenities: ['Outlets', 'Whiteboard'],         noiseLevel: 'quiet'    },
    ],
    LILY: [
        { name: 'LILY 1105', floor: 1, capacity: 80, amenities: ['Projector', 'Outlets'],           noiseLevel: 'loud'     },
        { name: 'LILY 2102', floor: 2, capacity: 40, amenities: ['Whiteboard', 'Outlets'],          noiseLevel: 'moderate' },
    ],
    MATH: [
        { name: 'MATH 175', floor: 1, capacity: 120, amenities: ['Projector'],                      noiseLevel: 'loud'     },
        { name: 'MATH 211', floor: 2, capacity: 30,  amenities: ['Whiteboard', 'Outlets'],          noiseLevel: 'moderate' },
    ],
    STEW: [
        { name: 'STEW 214',   floor: 2, capacity: 50, amenities: ['Projector', 'Outlets'],          noiseLevel: 'moderate' },
        { name: 'STEW Lounge',floor: 1, capacity: 30, amenities: ['Outlets', 'Cafe'],               noiseLevel: 'moderate' },
    ],
    WALC: [
        { name: 'WALC 1018', floor: 1, capacity: 30, amenities: ['Whiteboard', 'Projector'],        noiseLevel: 'moderate' },
        { name: 'WALC 1055', floor: 1, capacity: 20, amenities: ['Outlets', 'Whiteboard'],          noiseLevel: 'quiet'    },
        { name: 'WALC 2051', floor: 2, capacity: 50, amenities: ['Projector', 'Outlets', 'Whiteboard'], noiseLevel: 'moderate' },
        { name: 'WALC 3087', floor: 3, capacity: 40, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'loud'  },
    ],
};

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Wipe existing data so re-runs never create duplicates
        await Building.deleteMany({});
        await Room.deleteMany({});
        console.log('Cleared existing buildings and rooms');

        // Insert buildings (already in alphabetical order above)
        const createdBuildings = await Building.insertMany(buildingsData);
        console.log(`Inserted ${createdBuildings.length} buildings`);

        // Build rooms array using real _id references
        const allRooms = [];
        for (const building of createdBuildings) {
            const rooms = roomsData[building.abbreviation] || [];
            for (const room of rooms) {
                allRooms.push({ ...room, buildingId: building._id });
            }
        }

        const createdRooms = await Room.insertMany(allRooms);
        console.log(`Inserted ${createdRooms.length} rooms`);

        console.log('Seed complete!');
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
