require('dotenv').config();
const mongoose = require('mongoose');
const Building = require('./models/Building');
const Room = require('./models/Room');
const Course = require('./models/Course');

const MONGO_URI = process.env.MONGO_URI;

const buildingsData = [
    {
        name: 'Electrical Engineering Building',
        abbreviation: 'EE',
        latitude: 40.42883444389635, 
        longitude: -86.9119883321832,
        address: '465 Northwestern Ave, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs'],
    },
    {
        name: 'Hampton Hall of Civil Engineering',
        abbreviation: 'HAMP',
        latitude: 40.43019349980344,
        longitude: -86.91486761834622,
        address: '550 Stadium Mall Dr, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Study Lounges'],
    },
    {
        name: 'Hicks Undergraduate Library',
        abbreviation: 'HIKS',
        latitude: 40.42454060856231, 
        longitude: -86.91262212919347,
        address: '504 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Quiet Zones', 'Printers', 'Study Rooms'],
    },
    {
        name: 'Krannert Building',
        abbreviation: 'KRAN',
        latitude: 40.42374755906817,
        longitude: -86.91091465727949,
        address: '403 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Lecture Halls', 'Group Rooms'],
    },
    {
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42760280567151,
        longitude: -86.91701966591984,
        address: '305 N University St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs', 'Whiteboards'],
    },
    {
        name: 'Lilly Hall of Life Sciences',
        abbreviation: 'LILY',
        latitude: 40.42344999072248,
        longitude:  -86.9179316212151,
        address: '915 Mitch Daniels Blvd, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Study Lounges', 'Labs'],
    },
    {
        name: 'Mathematical Sciences Building',
        abbreviation: 'MATH',
        latitude: 40.42624094417116, 
        longitude: -86.91572329611937,
        address: '150 N University St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards', 'Study Lounges'],
    },
    {
        name: 'Stewart Center',
        abbreviation: 'STEW',
        latitude: 40.4251124624635,
        longitude: -86.91295899995546,
        address: '128 Memorial Mall, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Cafe', 'Auditorium', 'Study Lounges'],
    },
    {
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42752991318529, 
        longitude: -86.91319136101905,
        address: '340 Centennial Mall Dr, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards', 'Cafe', 'Group Rooms'],
    },
    {
        name: 'Neil Armstrong Hall of Engineering',
        abbreviation: 'ARMS',
        latitude: 40.431053926306774,
        longitude: -86.91484266728963,
        address: '701 W Stadium Ave, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards', 'Cafe'],
    },
    {
        name: 'Hall of Data Science and AI',
        abbreviation: 'DSAI',
        latitude: 40.42900113393102,
        longitude:  -86.91481479471226,
        address: '475 Stadium Mall Drive, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards','Group Rooms'],
    },
    {
        name: 'Dudley Hall',
        abbreviation: 'DUDL',
        latitude: 40.42723581771787,
        longitude: -86.91128030054516,
        address: '420 Central Dr, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards','Group Rooms'],
    },
];

// Rooms keyed by building abbreviation
const roomsData = {
    EE: [
        { name: 'EE 117', floor: 1, capacity: 200, amenities: ['Projector', 'Outlets'], noiseLevel: 'loud' },
        { name: 'EE 207', floor: 2, capacity: 40, amenities: ['Outlets', 'Whiteboard'], noiseLevel: 'moderate' },
        { name: 'EE 309', floor: 3, capacity: 25, amenities: ['Whiteboard'], noiseLevel: 'quiet' },
    ],
    HAMP: [
        { name: 'HAMP 1231', floor: 1, capacity: 60, amenities: ['Projector'], noiseLevel: 'moderate' },
        { name: 'HAMP 2201', floor: 2, capacity: 25, amenities: ['Outlets', 'Whiteboard'], noiseLevel: 'quiet' },
    ],
    HEAV: [
        { name: 'HEAV 226', floor: 2, capacity: 35, amenities: ['Projector'], noiseLevel: 'moderate' },
        { name: 'HEAV 331', floor: 3, capacity: 25, amenities: ['Whiteboard'], noiseLevel: 'quiet' },
    ],
    HIKS: [
        { name: 'HIKS Study Room A', floor: 1, capacity: 8, amenities: ['Whiteboard'], noiseLevel: 'quiet' },
        { name: 'HIKS Study Room B', floor: 1, capacity: 8, amenities: ['Whiteboard'], noiseLevel: 'quiet' },
        { name: 'HIKS Open Area', floor: 2, capacity: 100, amenities: ['Outlets', 'Printers'], noiseLevel: 'moderate' },
    ],
    KRAN: [
        { name: 'KRAN G001', floor: 0, capacity: 80, amenities: ['Projector', 'Outlets'], noiseLevel: 'loud' },
        { name: 'KRAN 105', floor: 1, capacity: 35, amenities: ['Whiteboard', 'Outlets'], noiseLevel: 'moderate' },
    ],
    LWSN: [
        { name: 'LWSN B134', floor: 0, capacity: 200, amenities: ['Projector', 'Outlets'], noiseLevel: 'loud' },
        { name: 'LWSN 1106', floor: 1, capacity: 45, amenities: ['Whiteboard', 'Outlets'], noiseLevel: 'moderate' },
        { name: 'LWSN 3102', floor: 3, capacity: 30, amenities: ['Outlets', 'Whiteboard'], noiseLevel: 'quiet' },
    ],
    LILY: [
        { name: 'LILY 1105', floor: 1, capacity: 80, amenities: ['Projector', 'Outlets'], noiseLevel: 'loud' },
        { name: 'LILY 2102', floor: 2, capacity: 40, amenities: ['Whiteboard', 'Outlets'], noiseLevel: 'moderate' },
    ],
    MATH: [
        { name: 'MATH 175', floor: 1, capacity: 120, amenities: ['Projector'], noiseLevel: 'loud' },
        { name: 'MATH 211', floor: 2, capacity: 30, amenities: ['Whiteboard', 'Outlets'], noiseLevel: 'moderate' },
    ],
    STEW: [
        { name: 'STEW 214', floor: 2, capacity: 50, amenities: ['Projector', 'Outlets'], noiseLevel: 'moderate' },
        { name: 'STEW Lounge', floor: 1, capacity: 30, amenities: ['Outlets', 'Cafe'], noiseLevel: 'moderate' },
    ],
    WALC: [
        { name: 'WALC 1018', floor: 1, capacity: 30, amenities: ['Whiteboard', 'Projector'], noiseLevel: 'moderate' },
        { name: 'WALC 1055', floor: 1, capacity: 20, amenities: ['Outlets', 'Whiteboard'], noiseLevel: 'quiet' },
        { name: 'WALC 2051', floor: 2, capacity: 50, amenities: ['Projector', 'Outlets', 'Whiteboard'], noiseLevel: 'moderate' },
        { name: 'WALC 3087', floor: 3, capacity: 40, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'loud' },
    ],
    DUDL: [
        { name: 'DUDL 1119', floor: 1, capacity: 30, amenities: ['Whiteboard', 'Projector'], noiseLevel: 'moderate' },
        { name: 'DUDL 1383', floor: 1, capacity: 30, amenities: ['Lab'], noiseLevel: 'quiet' },
        { name: 'DUDL 1389 (Trimple Technology Lab)', floor: 1, capacity: 50, amenities: ['Surveying Equipment'], noiseLevel: 'moderate' },
        { name: 'DUDL 4331', floor: 4, capacity: 40, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'moderate' },
    ],
    DSAI: [
        { name: 'DSAI 1004', floor: 1, capacity: 30, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'moderate' },
        { name: 'DSAI 1069', floor: 1, capacity: 30, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'moderate' },
        { name: 'DSAI 2041', floor: 2, capacity: 30, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'moderate' },
        { name: 'DSAI 2105', floor: 2, capacity: 30, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'moderate' },
    ],
    ARMS: [
        { name: 'ARMS 3001', floor: 3, capacity: 30, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'moderate' },
        { name: 'ARMS 3041', floor: 3, capacity: 30, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'moderate' },
    ],
};

// ─── Course Data ──────────────────────────────────────────────────────────────
// Representative Purdue courses for Spring 2026
const coursesData = [
    // Computer Science
    { courseCode: 'CS 18000',  department: 'CS', title: 'Problem Solving And Object-Oriented Programming',        semester: 'Spring 2026', credits: 4 },
    { courseCode: 'CS 18200',  department: 'CS', title: 'Foundations of Computer Science',                        semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 24000',  department: 'CS', title: 'Programming in C',                                       semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 25000',  department: 'CS', title: 'Computer Architecture',                                  semester: 'Spring 2026', credits: 4 },
    { courseCode: 'CS 25100',  department: 'CS', title: 'Data Structures and Algorithms',                         semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 30700',  department: 'CS', title: 'Software Engineering I',                                 semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 35400',  department: 'CS', title: 'Operating Systems',                                      semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 37300',  department: 'CS', title: 'Data Mining and Machine Learning',                       semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 38100',  department: 'CS', title: 'Introduction to the Analysis of Algorithms',             semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 40800',  department: 'CS', title: 'Software Testing',                                       semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 42200',  department: 'CS', title: 'Computer Networks',                                      semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 44800',  department: 'CS', title: 'Introduction to Relational Database Systems',            semester: 'Spring 2026', credits: 3 },
    { courseCode: 'CS 47100',  department: 'CS', title: 'Introduction to Artificial Intelligence',                semester: 'Spring 2026', credits: 3 },
    // Mathematics
    { courseCode: 'MA 16100',  department: 'MA', title: 'Plane Analytic Geometry and Calculus I',                 semester: 'Spring 2026', credits: 5 },
    { courseCode: 'MA 16200',  department: 'MA', title: 'Plane Analytic Geometry and Calculus II',                semester: 'Spring 2026', credits: 5 },
    { courseCode: 'MA 26100',  department: 'MA', title: 'Multivariate Calculus',                                  semester: 'Spring 2026', credits: 4 },
    { courseCode: 'MA 26500',  department: 'MA', title: 'Linear Algebra',                                         semester: 'Spring 2026', credits: 3 },
    { courseCode: 'MA 26600',  department: 'MA', title: 'Ordinary Differential Equations',                        semester: 'Spring 2026', credits: 3 },
    { courseCode: 'MA 34100',  department: 'MA', title: 'Foundations of Analysis',                                semester: 'Spring 2026', credits: 3 },
    { courseCode: 'MA 35100',  department: 'MA', title: 'Elementary Linear Algebra',                              semester: 'Spring 2026', credits: 3 },
    // Electrical and Computer Engineering
    { courseCode: 'ECE 20001', department: 'ECE', title: 'Electrical Engineering Fundamentals I',                 semester: 'Spring 2026', credits: 4 },
    { courseCode: 'ECE 20002', department: 'ECE', title: 'Electrical Engineering Fundamentals II',                semester: 'Spring 2026', credits: 4 },
    { courseCode: 'ECE 30100', department: 'ECE', title: 'Signals and Systems',                                   semester: 'Spring 2026', credits: 3 },
    { courseCode: 'ECE 36800', department: 'ECE', title: 'Data Structures',                                       semester: 'Spring 2026', credits: 3 },
    // Statistics
    { courseCode: 'STAT 35000', department: 'STAT', title: 'Introduction to Statistics',                          semester: 'Spring 2026', credits: 3 },
    { courseCode: 'STAT 41600', department: 'STAT', title: 'Probability',                                         semester: 'Spring 2026', credits: 3 },
    // Physics
    { courseCode: 'PHYS 17200', department: 'PHYS', title: 'Modern Mechanics',                                    semester: 'Spring 2026', credits: 4 },
    { courseCode: 'PHYS 27200', department: 'PHYS', title: 'Electric and Magnetic Interactions',                  semester: 'Spring 2026', credits: 4 },
    // Management
    { courseCode: 'MGMT 20000', department: 'MGMT', title: 'Introductory Accounting',                             semester: 'Spring 2026', credits: 3 },
    { courseCode: 'MGMT 31000', department: 'MGMT', title: 'Financial Management',                                semester: 'Spring 2026', credits: 3 },
];

async function seed() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // ── Buildings & Rooms ──────────────────────────────────────────────────
        await Building.deleteMany({});
        await Room.deleteMany({});
        console.log('Cleared existing buildings and rooms');

        const createdBuildings = await Building.insertMany(buildingsData);
        console.log(`Inserted ${createdBuildings.length} buildings`);

        const allRooms = [];
        for (const building of createdBuildings) {
            const rooms = roomsData[building.abbreviation] || [];
            for (const room of rooms) {
                allRooms.push({ ...room, buildingId: building._id });
            }
        }
        const createdRooms = await Room.insertMany(allRooms);
        console.log(`Inserted ${createdRooms.length} rooms`);

        // ── Courses ────────────────────────────────────────────────────────────
        await Course.deleteMany({});
        console.log('Cleared existing courses');

        const createdCourses = await Course.insertMany(coursesData);
        console.log(`Inserted ${createdCourses.length} courses`);

        console.log('Seed complete!');
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

seed();