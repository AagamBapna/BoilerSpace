const { haversineDistance } = require('../utils/distance');

describe('Haversine Distance', () => {
    test('returns 0 for same point', () => {
        expect(haversineDistance(40.4237, -86.9212, 40.4237, -86.9212)).toBe(0);
    });
    test('calculates distance between two Purdue buildings', () => {
        // Lawson to WALC
        const dist = haversineDistance(40.4278, -86.9169, 40.4274, -86.9127);
        expect(dist).toBeGreaterThan(0.01);
        expect(dist).toBeLessThan(1);
    });
    test('returns correct approximate distance for known points', () => {
        // MetLife Stadium to Caesars Superdome (~65 miles)
        const dist = haversineDistance(40.8135, -74.0745, 29.9511, -90.0811);
        expect(dist).toBeGreaterThan(1100);
        expect(dist).toBeLessThan(1500);
    });
});