import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatRelative, formatAbsolute } from '../utils/formatRelative';
import BookmarkedRooms from '../components/BookmarkedRooms';

// Mock axios to prevent real API calls
vi.mock('axios', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: [] })),
        put: vi.fn(() => Promise.resolve({ data: {} })),
    },
}));

describe('formatRelative', () => {
    const fixedNow = new Date('2026-03-28T12:00:00Z').getTime();

    beforeEach(() => {
        vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('returns "N/A" for null', () => {
        expect(formatRelative(null)).toBe('N/A');
    });

    test('returns "N/A" for undefined', () => {
        expect(formatRelative(undefined)).toBe('N/A');
    });

    test('returns "N/A" for invalid date string', () => {
        expect(formatRelative('not-a-date')).toBe('N/A');
    });

    test('returns "just now" for less than 1 minute ago', () => {
        const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
        expect(formatRelative(tenSecondsAgo)).toBe('just now');
    });

    test('returns "X min ago" for minutes', () => {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        expect(formatRelative(fiveMinAgo)).toBe('5 min ago');
    });

    test('returns "1 hr ago" for one hour', () => {
        const oneHrAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        expect(formatRelative(oneHrAgo)).toBe('1 hr ago');
    });

    test('returns "X hrs ago" for multiple hours', () => {
        const threeHrsAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        expect(formatRelative(threeHrsAgo)).toBe('3 hrs ago');
    });

    test('returns "1 day ago" for one day', () => {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        expect(formatRelative(oneDayAgo)).toBe('1 day ago');
    });

    test('returns "X days ago" for multiple days', () => {
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
        expect(formatRelative(fiveDaysAgo)).toBe('5 days ago');
    });
});

describe('formatAbsolute', () => {
    test('returns "N/A" for null', () => {
        expect(formatAbsolute(null)).toBe('N/A');
    });

    test('returns "N/A" for undefined', () => {
        expect(formatAbsolute(undefined)).toBe('N/A');
    });

    test('returns "N/A" for invalid date', () => {
        expect(formatAbsolute('garbage')).toBe('N/A');
    });

    test('returns formatted date string with date, time, and timezone (AC2)', () => {
        const result = formatAbsolute('2026-03-23T15:45:00Z');
        // Should contain month, day, year
        expect(result).toMatch(/Mar/);
        expect(result).toMatch(/23/);
        expect(result).toMatch(/2026/);
        // Should contain time
        expect(result).toMatch(/\d{1,2}:\d{2}/);
        // Should contain AM/PM
        expect(result).toMatch(/AM|PM/);
        // Should contain timezone abbreviation (e.g. UTC, EST, EDT, etc.)
        expect(result).toMatch(/[A-Z]{2,4}/);
    });
});

describe('Room timestamp UI rendering', () => {
    test('AC4: shows "Last updated: N/A" when room has no lastStatusUpdate', () => {
        const bookmarks = [
            {
                _id: 'room1',
                name: 'LWSN B134',
                floor: 0,
                capacity: 200,
                noiseLevel: 'loud',
                amenities: [],
                currentOccupancy: 0,
                lastStatusUpdate: null,
                buildingId: { _id: 'b1', name: 'Lawson', abbreviation: 'LWSN' },
            },
        ];

        render(
            <BookmarkedRooms
                bookmarks={bookmarks}
                onToggleBookmark={vi.fn()}
                onSelectBuilding={vi.fn()}
                buildings={[]}
            />
        );

        expect(screen.getByText(/Last updated: N\/A/)).toBeInTheDocument();
    });

    test('AC1: shows relative timestamp when room has lastStatusUpdate', () => {
        vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-28T12:00:00Z').getTime());

        const bookmarks = [
            {
                _id: 'room2',
                name: 'WALC 1018',
                floor: 1,
                capacity: 30,
                noiseLevel: 'moderate',
                amenities: [],
                currentOccupancy: 5,
                lastStatusUpdate: new Date('2026-03-28T11:55:00Z').toISOString(),
                buildingId: { _id: 'b2', name: 'WALC', abbreviation: 'WALC' },
            },
        ];

        render(
            <BookmarkedRooms
                bookmarks={bookmarks}
                onToggleBookmark={vi.fn()}
                onSelectBuilding={vi.fn()}
                buildings={[]}
            />
        );

        expect(screen.getByText(/Last updated: 5 min ago/)).toBeInTheDocument();

        vi.restoreAllMocks();
    });

    test('AC2: timestamp element has tooltip with absolute date including timezone', () => {
        const lastUpdate = '2026-03-23T15:45:00Z';
        const bookmarks = [
            {
                _id: 'room3',
                name: 'HAMP 2201',
                floor: 2,
                capacity: 50,
                noiseLevel: 'quiet',
                amenities: [],
                currentOccupancy: 3,
                lastStatusUpdate: lastUpdate,
                buildingId: { _id: 'b3', name: 'Hampton', abbreviation: 'HAMP' },
            },
        ];

        render(
            <BookmarkedRooms
                bookmarks={bookmarks}
                onToggleBookmark={vi.fn()}
                onSelectBuilding={vi.fn()}
                buildings={[]}
            />
        );

        const timestampEl = screen.getByText(/Last updated:/);
        const tooltip = timestampEl.getAttribute('data-tooltip');
        // Tooltip should contain date, time, and timezone per AC2
        expect(tooltip).toMatch(/Mar/);
        expect(tooltip).toMatch(/23/);
        expect(tooltip).toMatch(/2026/);
        expect(tooltip).toMatch(/[A-Z]{2,4}/); // timezone abbreviation
    });
});
