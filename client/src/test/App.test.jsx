import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Mapbox GL — it requires WebGL which happy-dom doesn't have
vi.mock('mapbox-gl', () => {
    // Must use function constructors (not arrow fns) for `new` calls
    function MockMap() {
        this.addControl = vi.fn();
        this.on = vi.fn();
        this.remove = vi.fn();
        this.flyTo = vi.fn();
    }
    function MockNavigationControl() { }
    function MockGeolocateControl() { }
    function MockMarker() {
        this.setLngLat = vi.fn().mockReturnThis();
        this.addTo = vi.fn().mockReturnThis();
        this.remove = vi.fn();
        this.getElement = vi.fn(() => document.createElement('div'));
    }
    function MockPopup() {
        this.setLngLat = vi.fn().mockReturnThis();
        this.setHTML = vi.fn().mockReturnThis();
        this.addTo = vi.fn().mockReturnThis();
        this.remove = vi.fn();
    }
    return {
        default: {
            Map: MockMap,
            NavigationControl: MockNavigationControl,
            GeolocateControl: MockGeolocateControl,
            Marker: MockMarker,
            Popup: MockPopup,
            accessToken: '',
        },
        Map: MockMap,
        NavigationControl: MockNavigationControl,
        GeolocateControl: MockGeolocateControl,
        Marker: MockMarker,
        Popup: MockPopup,
    };
});

vi.mock('../lib/auth', () => ({
    getToken: vi.fn(() => null),
    setToken: vi.fn(),
    clearToken: vi.fn(),
}));

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        defaults: { headers: { common: {} } },
    },
}));

import axios from 'axios';
import { getToken } from '../lib/auth';

// ─── Sample data ──────────────────────────────────────────────────────────────

const sampleBuildings = [
    {
        _id: 'b001',
        name: 'Wilmeth Active Learning Center',
        abbreviation: 'WALC',
        latitude: 40.42713,
        longitude: -86.91370,
        address: '496 Northwestern Ave',
        amenities: ['Wi-Fi', 'Outlets'],
    },
    {
        _id: 'b002',
        name: 'Lawson Computer Science Building',
        abbreviation: 'LWSN',
        latitude: 40.42782,
        longitude: -86.91693,
        address: '305 N University St',
        amenities: ['Wi-Fi', 'Computer Labs'],
    },
];

const sampleRooms = [
    { _id: 'r001', buildingId: 'b001', name: 'WALC 1018', floor: 1, capacity: 30, amenities: ['Whiteboard'], noiseLevel: 'moderate' },
    { _id: 'r002', buildingId: 'b001', name: 'WALC 3087', floor: 3, capacity: 40, amenities: ['Projector'], noiseLevel: 'loud' },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('App — Loading & Error States', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getToken.mockReturnValue(null);
    });

    test('shows loading spinner while fetching buildings', () => {
        // API never resolves — stays loading
        axios.get.mockReturnValue(new Promise(() => { }));
        render(<App />);
        expect(screen.getByText('Loading BoilerSpace...')).toBeInTheDocument();
    });

    test('shows error message when API fails', async () => {
        axios.get.mockRejectedValueOnce(new Error('Network Error'));
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Connection Error')).toBeInTheDocument();
        });
        expect(screen.getByText(/Failed to load buildings/)).toBeInTheDocument();
        expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    test('shows login form when not authenticated', async () => {
        axios.get.mockResolvedValueOnce({ data: sampleBuildings });
        render(<App />);
        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
        });
        expect(screen.getByPlaceholderText('you@purdue.edu')).toBeInTheDocument();
    });

    test('renders sidebar and map after successful fetch', async () => {
        getToken.mockReturnValue('fake-token');
        axios.get
            .mockResolvedValueOnce({ data: { id: 'u1', email: 't@t.com', displayName: 'Test' } })
            .mockResolvedValueOnce({ data: sampleBuildings });
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('BoilerSpace')).toBeInTheDocument();
        });
        expect(screen.getByText('Find your study spot')).toBeInTheDocument();
    });
});

describe('App — Building List Rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getToken.mockReturnValue('fake-token');
        axios.get
            .mockResolvedValueOnce({ data: { id: 'u1', email: 't@t.com', displayName: 'Test' } })
            .mockResolvedValueOnce({ data: sampleBuildings });
    });

    test('displays all buildings in the sidebar list', async () => {
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Wilmeth Active Learning Center')).toBeInTheDocument();
        });
        expect(screen.getByText('Lawson Computer Science Building')).toBeInTheDocument();
    });

    test('shows building count', async () => {
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('2 buildings')).toBeInTheDocument();
        });
    });

    test('shows building abbreviations', async () => {
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('WALC')).toBeInTheDocument();
        });
        expect(screen.getByText('LWSN')).toBeInTheDocument();
    });
});

describe('App — Building Selection & Room Display', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getToken.mockReturnValue('fake-token');
    });

    test('clicking a building shows its detail view with rooms', async () => {
        const user = userEvent.setup();
        axios.get
            .mockResolvedValueOnce({ data: { id: 'u1', email: 't@t.com', displayName: 'Test' } })
            .mockResolvedValueOnce({ data: sampleBuildings })
            .mockResolvedValueOnce({ data: sampleRooms });

        render(<App />);

        // Wait for buildings to load
        await waitFor(() => {
            expect(screen.getByText('Wilmeth Active Learning Center')).toBeInTheDocument();
        });

        // Click WALC building
        const walcButton = screen.getByText('Wilmeth Active Learning Center');
        await user.click(walcButton);

        // Should show building detail view
        await waitFor(() => {
            expect(screen.getByText('All Buildings')).toBeInTheDocument();
        });
        expect(screen.getByText('WALC · 496 Northwestern Ave')).toBeInTheDocument();

        // Should fetch and show rooms
        await waitFor(() => {
            expect(screen.getByText('WALC 1018')).toBeInTheDocument();
        });
        expect(screen.getByText('WALC 3087')).toBeInTheDocument();
        expect(screen.getByText('Rooms (2)')).toBeInTheDocument();
    });

    test('clicking "All Buildings" returns to the building list', async () => {
        const user = userEvent.setup();
        axios.get
            .mockResolvedValueOnce({ data: { id: 'u1', email: 't@t.com', displayName: 'Test' } })
            .mockResolvedValueOnce({ data: sampleBuildings })
            .mockResolvedValueOnce({ data: sampleRooms });

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Wilmeth Active Learning Center')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Wilmeth Active Learning Center'));
        await waitFor(() => {
            expect(screen.getByText('All Buildings')).toBeInTheDocument();
        });

        // Click back
        await user.click(screen.getByText('All Buildings'));
        await waitFor(() => {
            expect(screen.getByText('2 buildings')).toBeInTheDocument();
        });
    });

    test('shows room capacity and noise level', async () => {
        const user = userEvent.setup();
        axios.get
            .mockResolvedValueOnce({ data: { id: 'u1', email: 't@t.com', displayName: 'Test' } })
            .mockResolvedValueOnce({ data: sampleBuildings })
            .mockResolvedValueOnce({ data: sampleRooms });

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Wilmeth Active Learning Center')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Wilmeth Active Learning Center'));
        await waitFor(() => {
            expect(screen.getByText('WALC 1018')).toBeInTheDocument();
        });

        expect(screen.getByText('👥 30 seats')).toBeInTheDocument();
        expect(screen.getByText('💬 moderate')).toBeInTheDocument();
    });

    test('shows empty rooms message when a building has no rooms', async () => {
        const user = userEvent.setup();
        axios.get
            .mockResolvedValueOnce({ data: { id: 'u1', email: 't@t.com', displayName: 'Test' } })
            .mockResolvedValueOnce({ data: sampleBuildings })
            .mockResolvedValueOnce({ data: [] });

        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('Wilmeth Active Learning Center')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Wilmeth Active Learning Center'));
        await waitFor(() => {
            expect(screen.getByText('No rooms found')).toBeInTheDocument();
        });
    });
});

describe('App — Sidebar Search Filter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getToken.mockReturnValue('fake-token');
        axios.get
            .mockResolvedValueOnce({ data: { id: 'u1', email: 't@t.com', displayName: 'Test' } })
            .mockResolvedValueOnce({ data: sampleBuildings });
    });

    test('filters buildings by name', async () => {
        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('2 buildings')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search buildings/);
        await user.type(searchInput, 'Lawson');

        await waitFor(() => {
            expect(screen.getByText('1 building')).toBeInTheDocument();
        });
        expect(screen.getByText('Lawson Computer Science Building')).toBeInTheDocument();
        expect(screen.queryByText('Wilmeth Active Learning Center')).not.toBeInTheDocument();
    });

    test('filters buildings by abbreviation', async () => {
        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('2 buildings')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search buildings/);
        await user.type(searchInput, 'WALC');

        await waitFor(() => {
            expect(screen.getByText('1 building')).toBeInTheDocument();
        });
        // Building appears in both sidebar list and search dropdown
        expect(screen.getAllByText('Wilmeth Active Learning Center').length).toBeGreaterThanOrEqual(1);
    });

    test('shows "no buildings found" for unmatched query', async () => {
        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('2 buildings')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search buildings/);
        await user.type(searchInput, 'XYZ999');

        await waitFor(() => {
            expect(screen.getByText(/No buildings found/)).toBeInTheDocument();
        });
    });

    test('restores full list when search is cleared', async () => {
        const user = userEvent.setup();
        render(<App />);
        await waitFor(() => {
            expect(screen.getByText('2 buildings')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/Search buildings/);
        await user.type(searchInput, 'WALC');
        await waitFor(() => {
            expect(screen.getByText('1 building')).toBeInTheDocument();
        });

        await user.clear(searchInput);
        await waitFor(() => {
            expect(screen.getByText('2 buildings')).toBeInTheDocument();
        });
    });
});
