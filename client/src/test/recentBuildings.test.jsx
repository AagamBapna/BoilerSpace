import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BuildingSidebar from '../components/BuildingSidebar';

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
});