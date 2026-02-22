// In-memory pseudo data for Purdue campus buildings and rooms
// This will be replaced with MongoDB models when the database is set up

const buildings = [
    {
        _id: 'b001',
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42713,
        longitude: -86.91370,
        address: '496 Northwestern Ave, West Lafayette, IN 47906',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards', 'Cafe', 'Group Rooms'],
    },
    {
        _id: 'b002',
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        address: '305 N University St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs', 'Whiteboards'],
    },
    {
        _id: 'b003',
        name: 'Hampton Hall of Civil Engineering',
        abbreviation: 'HAMP',
        latitude: 40.42365,
        longitude: -86.91287,
        address: '550 Stadium Mall Dr, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Study Lounges'],
    },
    {
        _id: 'b004',
        name: 'Hicks Undergraduate Library',
        abbreviation: 'HIKS',
        latitude: 40.42464,
        longitude: -86.91126,
        address: '504 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Quiet Zones', 'Printers', 'Study Rooms'],
    },
    {
        _id: 'b005',
        name: 'Krannert Building',
        abbreviation: 'KRAN',
        latitude: 40.42350,
        longitude: -86.91010,
        address: '403 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Lecture Halls', 'Group Rooms'],
    },
    {
        _id: 'b006',
        name: 'Mathematical Sciences Building',
        abbreviation: 'MATH',
        latitude: 40.42382,
        longitude: -86.91606,
        address: '150 N University St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Whiteboards', 'Study Lounges'],
    },
    {
        _id: 'b007',
        name: 'Electrical Engineering Building',
        abbreviation: 'EE',
        latitude: 40.42294,
        longitude: -86.91428,
        address: '465 Northwestern Ave, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Computer Labs'],
    },
    {
        _id: 'b008',
        name: 'Stewart Center',
        abbreviation: 'STEW',
        latitude: 40.42478,
        longitude: -86.91284,
        address: '128 Memorial Mall, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Cafe', 'Auditorium', 'Study Lounges'],
    },
    {
        _id: 'b009',
        name: 'Heavilon Hall',
        abbreviation: 'HEAV',
        latitude: 40.42552,
        longitude: -86.91027,
        address: '500 Oval Dr, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Classrooms'],
    },
    {
        _id: 'b010',
        name: 'Lilly Hall of Life Sciences',
        abbreviation: 'LILY',
        latitude: 40.42270,
        longitude: -86.91760,
        address: '915 W State St, West Lafayette, IN 47907',
        amenities: ['Wi-Fi', 'Outlets', 'Study Lounges', 'Labs'],
    },
];

const rooms = [
    // WALC
    { _id: 'r001', buildingId: 'b001', name: 'WALC 1018', floor: 1, capacity: 30, amenities: ['Whiteboard', 'Projector'], noiseLevel: 'moderate' },
    { _id: 'r002', buildingId: 'b001', name: 'WALC 1055', floor: 1, capacity: 20, amenities: ['Outlets', 'Whiteboard'], noiseLevel: 'quiet' },
    { _id: 'r003', buildingId: 'b001', name: 'WALC 2051', floor: 2, capacity: 50, amenities: ['Projector', 'Outlets', 'Whiteboard'], noiseLevel: 'moderate' },
    { _id: 'r004', buildingId: 'b001', name: 'WALC 3087', floor: 3, capacity: 40, amenities: ['Whiteboard', 'Projector', 'Outlets'], noiseLevel: 'loud' },
    // Lawson
    { _id: 'r005', buildingId: 'b002', name: 'LWSN B134', floor: 0, capacity: 200, amenities: ['Projector', 'Outlets'], noiseLevel: 'loud' },
    { _id: 'r006', buildingId: 'b002', name: 'LWSN 1106', floor: 1, capacity: 45, amenities: ['Whiteboard', 'Outlets'], noiseLevel: 'moderate' },
    { _id: 'r007', buildingId: 'b002', name: 'LWSN 3102', floor: 3, capacity: 30, amenities: ['Outlets', 'Whiteboards'], noiseLevel: 'quiet' },
    // HAMP
    { _id: 'r008', buildingId: 'b003', name: 'HAMP 1231', floor: 1, capacity: 60, amenities: ['Projector'], noiseLevel: 'moderate' },
    { _id: 'r009', buildingId: 'b003', name: 'HAMP 2201', floor: 2, capacity: 25, amenities: ['Outlets', 'Whiteboard'], noiseLevel: 'quiet' },
    // Hicks
    { _id: 'r010', buildingId: 'b004', name: 'HIKS Study Room A', floor: 1, capacity: 8, amenities: ['Whiteboard'], noiseLevel: 'quiet' },
    { _id: 'r011', buildingId: 'b004', name: 'HIKS Study Room B', floor: 1, capacity: 8, amenities: ['Whiteboard'], noiseLevel: 'quiet' },
    { _id: 'r012', buildingId: 'b004', name: 'HIKS Open Area', floor: 2, capacity: 100, amenities: ['Outlets', 'Printers'], noiseLevel: 'moderate' },
    // Krannert
    { _id: 'r013', buildingId: 'b005', name: 'KRAN G001', floor: 0, capacity: 80, amenities: ['Projector', 'Outlets'], noiseLevel: 'loud' },
    { _id: 'r014', buildingId: 'b005', name: 'KRAN 105', floor: 1, capacity: 35, amenities: ['Whiteboard', 'Outlets'], noiseLevel: 'moderate' },
    // MATH
    { _id: 'r015', buildingId: 'b006', name: 'MATH 175', floor: 1, capacity: 120, amenities: ['Projector'], noiseLevel: 'loud' },
    { _id: 'r016', buildingId: 'b006', name: 'MATH 211', floor: 2, capacity: 30, amenities: ['Whiteboard', 'Outlets'], noiseLevel: 'moderate' },
    // EE
    { _id: 'r017', buildingId: 'b007', name: 'EE 117', floor: 1, capacity: 200, amenities: ['Projector', 'Outlets'], noiseLevel: 'loud' },
    { _id: 'r018', buildingId: 'b007', name: 'EE 207', floor: 2, capacity: 40, amenities: ['Outlets', 'Whiteboard'], noiseLevel: 'moderate' },
    // Stewart
    { _id: 'r019', buildingId: 'b008', name: 'STEW 214', floor: 2, capacity: 50, amenities: ['Projector', 'Outlets'], noiseLevel: 'moderate' },
    { _id: 'r020', buildingId: 'b008', name: 'STEW Lounge', floor: 1, capacity: 30, amenities: ['Outlets', 'Cafe'], noiseLevel: 'moderate' },
    // Heavilon
    { _id: 'r021', buildingId: 'b009', name: 'HEAV 226', floor: 2, capacity: 35, amenities: ['Projector'], noiseLevel: 'moderate' },
    { _id: 'r022', buildingId: 'b009', name: 'HEAV 331', floor: 3, capacity: 25, amenities: ['Whiteboard'], noiseLevel: 'quiet' },
    // Lilly
    { _id: 'r023', buildingId: 'b010', name: 'LILY 1105', floor: 1, capacity: 80, amenities: ['Projector', 'Outlets'], noiseLevel: 'loud' },
    { _id: 'r024', buildingId: 'b010', name: 'LILY 2102', floor: 2, capacity: 40, amenities: ['Whiteboard', 'Outlets'], noiseLevel: 'moderate' },
];

module.exports = { buildings, rooms };
