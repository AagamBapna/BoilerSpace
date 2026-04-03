import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BuildingSidebar from '../components/BuildingSidebar';
import userEvent from '@testing-library/user-event';
import axios from 'axios';

vi.mock('mapbox-gl', () => ({ default: {} }));

vi.mock('../contexts/LocationContext', () => ({
    useLocation: vi.fn(() => ({
        locationStatus: 'granted',
        userLocation: [40, -86],
        requestLocationAccess: vi.fn(),
        resetLocationStatus: vi.fn(),
        disableLocationAccess: vi.fn(),
    }))
}));

vi.mock('axios', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: [] })),
        post: vi.fn(() => Promise.resolve({ data: {} }))
    }
}));

const mockBuildings = [
    { _id: '1', name: 'WALC', abbreviation: 'WALC', latitude: 40, longitude: -86, amenities: ['Wi-Fi'], address: '' },
    { _id: '2', name: 'Lawson', abbreviation: 'LWSN', latitude: 40, longitude: -86, amenities: ['Outlets'], address: '' },
];

describe('Recently Visited section', () => {
    test('renders recently visited buildings when data exists', () => {
        const recentBuildings = [
            { buildingId: mockBuildings[0], visitedAt: new Date().toISOString() },
            { buildingId: mockBuildings[1], visitedAt: new Date().toISOString() },
        ];

        render(
            <BuildingSidebar
                buildings={mockBuildings}
                selectedBuilding={null}
                onSelectBuilding={vi.fn()}
                onClose={vi.fn()}
                user={{ displayName: 'Test' }}
                onLogout={vi.fn()}
                recentBuildings={recentBuildings}
            />
        );

        expect(screen.getAllByText(/Recently Visited/)).toBeDefined();
        expect(screen.getAllByText('WALC')).toBeDefined();
        expect(screen.getAllByText('Lawson')).toBeDefined();
    });

    test('does not render recently visited section when empty', () => {
        render(
            <BuildingSidebar
                buildings={mockBuildings}
                selectedBuilding={null}
                onSelectBuilding={vi.fn()}
                onClose={vi.fn()}
                user={{ displayName: 'Test' }}
                onLogout={vi.fn()}
                recentBuildings={[]}
            />
        );
        expect(screen.queryByText(/Recently Visited/)).toBeNull();
    });
});

describe('Room amenity icons', () => {
    test('renders amenity icons on room cards', async () => {
        const selectedBuilding = mockBuildings[0];

        render(
            <BuildingSidebar
                buildings={mockBuildings}
                selectedBuilding={selectedBuilding}
                onSelectBuilding={vi.fn()}
                onClose={vi.fn()}
                user={{ displayName: 'Test' }}
                onLogout={vi.fn()}
                recentBuildings={[]}
            />
        );
    });

    describe('Amenity filter UI', () => {
        test('renders filter pills when a building is selected', () => {
            render(
                <BuildingSidebar
                    buildings={mockBuildings}
                    selectedBuilding={mockBuildings[0]}
                    onSelectBuilding={vi.fn()}
                    onClose={vi.fn()}
                    user={{ displayName: 'Test' }}
                    onLogout={vi.fn()}
                    recentBuildings={[]}
                />
            );
            expect(screen.getByText('Filter by Amenity')).toBeDefined();
            expect(screen.getByText('Whiteboard')).toBeDefined();
            expect(screen.getByText('Projector')).toBeDefined();
            expect(screen.getByText('Outlets')).toBeDefined();
        });
        test('does not show filter pills on building list view', () => {
            render(
                <BuildingSidebar
                    buildings={mockBuildings}
                    selectedBuilding={null}
                    onSelectBuilding={vi.fn()}
                    onClose={vi.fn()}
                    user={{ displayName: 'Test' }}
                    onLogout={vi.fn()}
                    recentBuildings={[]}
                />
            );
            expect(screen.queryByText('Filter by Amenity')).toBeNull();
        });
        test('shows clear filters button when a filter is active', async () => {
            const user = userEvent.setup();
            render(
                <BuildingSidebar
                    buildings={mockBuildings}
                    selectedBuilding={mockBuildings[0]}
                    onSelectBuilding={vi.fn()}
                    onClose={vi.fn()}
                    user={{ displayName: 'Test' }}
                    onLogout={vi.fn()}
                    recentBuildings={[]}
                />
            );
            // No clear button initially
            expect(screen.queryByText('Clear filters')).toBeNull();
            // Click Whiteboard filter
            await user.click(screen.getByText('Whiteboard'));
            // Clear button should now appear
            expect(screen.getByText('Clear filters')).toBeDefined();
        });
    });
});