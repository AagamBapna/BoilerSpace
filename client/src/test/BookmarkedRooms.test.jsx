import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookmarkedRooms from '../components/BookmarkedRooms';

// Sample Data
const sampleBuildings = [
    {
        _id: 'b001',
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        amenities: ['Wi-Fi', 'Computer Labs'],
    },
    {
        _id: 'b002',
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42713,
        longitude: -86.91370,
        amenities: ['Wi-Fi', 'Outlets'],
    },
];

const sampleBookmarks = [
    {
        _id: 'r001',
        name: 'LWSN B134',
        floor: 0,
        capacity: 200,
        noiseClassification: 'Collaborative',
        currentOccupancy: 45,
        amenities: ['Projector', 'Outlets'],
        buildingId: {
            _id: 'b001',
            name: 'Lawson Computer Science Building',
            abbreviation: 'LWSN',
            address: '305 N University St',
        },
    },
    {
        _id: 'r002',
        name: 'WALC 1018',
        floor: 1,
        capacity: 30,
        noiseClassification: 'Moderate',
        currentOccupancy: 22,
        amenities: ['Whiteboard'],
        buildingId: {
            _id: 'b002',
            name: 'Wilmeth Active Learning Center',
            abbreviation: 'WALC',
            address: '496 Northwestern Ave',
        },
    },
];

// Helpers
function renderBookmarkedRooms(overrides = {}) {
    const props = {
        bookmarks: sampleBookmarks,
        onToggleBookmark: vi.fn(),
        onSelectBuilding: vi.fn(),
        buildings: sampleBuildings,
        ...overrides,
    };
    render(<BookmarkedRooms {...props} />);
    return props;
}

// Tests 
describe('BookmarkedRooms', () => {
    describe('Empty State', () => {
        test('shows empty state message when no bookmarks', () => {
            renderBookmarkedRooms({ bookmarks: [] });
            expect(screen.getByText('No bookmarked rooms yet')).toBeInTheDocument();
            expect(screen.getByText(/Tap the heart icon/)).toBeInTheDocument();
        });

        test('does not show room count when no bookmarks', () => {
            renderBookmarkedRooms({ bookmarks: [] });
            expect(screen.queryByText(/\d+ bookmarked room/)).not.toBeInTheDocument();
        });
    });

    describe('Rendering Bookmarked Rooms', () => {
        test('renders all bookmarked rooms', () => {
            renderBookmarkedRooms();
            expect(screen.getByText('LWSN B134')).toBeInTheDocument();
            expect(screen.getByText('WALC 1018')).toBeInTheDocument();
        });

        test('shows bookmarked rooms count', () => {
            renderBookmarkedRooms();
            expect(screen.getByText('2 bookmarked rooms')).toBeInTheDocument();
        });

        test('shows singular count for one room', () => {
            renderBookmarkedRooms({ bookmarks: [sampleBookmarks[0]] });
            expect(screen.getByText('1 bookmarked room')).toBeInTheDocument();
        });

        test('shows building name and abbreviation for each room', () => {
            renderBookmarkedRooms();
            expect(screen.getByText(/LWSN · Lawson Computer Science Building/)).toBeInTheDocument();
            expect(screen.getByText(/WALC · Wilmeth Active Learning Center/)).toBeInTheDocument();
        });

        test('shows room capacity and noise level', () => {
            renderBookmarkedRooms();
            expect(screen.getByText(/200 seats/)).toBeInTheDocument();
            expect(screen.getByText(/loud/)).toBeInTheDocument();
            expect(screen.getByText(/30 seats/)).toBeInTheDocument();
            expect(screen.getByText(/moderate/)).toBeInTheDocument();
        });

        test('shows occupancy data', () => {
            renderBookmarkedRooms();
            expect(screen.getByText(/45\/200 checked in/)).toBeInTheDocument();
            expect(screen.getByText(/22\/30 checked in/)).toBeInTheDocument();
        });

        test('shows amenities for each room', () => {
            renderBookmarkedRooms();
            expect(screen.getByText('Projector')).toBeInTheDocument();
            expect(screen.getByText('Outlets')).toBeInTheDocument();
            expect(screen.getByText('Whiteboard')).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        test('calls onToggleBookmark with roomId and true when clicking heart', async () => {
            const user = userEvent.setup();
            const props = renderBookmarkedRooms();

            const removeButtons = screen.getAllByTitle('Remove bookmark');
            await user.click(removeButtons[0]);

            expect(props.onToggleBookmark).toHaveBeenCalledWith('r001', true);
        });

        test('calls onSelectBuilding when clicking building name link', async () => {
            const user = userEvent.setup();
            const props = renderBookmarkedRooms();

            const buildingLink = screen.getByText(/LWSN · Lawson Computer Science Building/);
            await user.click(buildingLink);

            expect(props.onSelectBuilding).toHaveBeenCalledWith(sampleBuildings[0]);
        });

        test('all bookmark buttons have "Remove bookmark" aria-label', () => {
            renderBookmarkedRooms();
            const buttons = screen.getAllByRole('button', { name: 'Remove bookmark' });
            expect(buttons).toHaveLength(2);
        });
    });

    describe('Occupancy Status Display', () => {
        test('shows Quiet status for low occupancy', () => {
            const quietRoom = [{
                ...sampleBookmarks[0],
                currentOccupancy: 10,
                capacity: 200,
            }];
            renderBookmarkedRooms({ bookmarks: quietRoom });
            expect(screen.getByText('Quiet')).toBeInTheDocument();
        });

        test('shows Moderate status for medium occupancy', () => {
            const modRoom = [{
                ...sampleBookmarks[0],
                currentOccupancy: 100,
                capacity: 200,
            }];
            renderBookmarkedRooms({ bookmarks: modRoom });
            expect(screen.getByText('Moderate')).toBeInTheDocument();
        });

        test('shows Busy status for high occupancy', () => {
            const busyRoom = [{
                ...sampleBookmarks[0],
                currentOccupancy: 180,
                capacity: 200,
            }];
            renderBookmarkedRooms({ bookmarks: busyRoom });
            expect(screen.getByText('Busy')).toBeInTheDocument();
        });
    });
});
