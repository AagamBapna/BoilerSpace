import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationBell from '../components/NotificationBell';
import axios from 'axios';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        patch: vi.fn(),
        defaults: { headers: { common: {} } },
    },
}));

const mockBuildings = [
    { _id: 'b1', name: 'WALC', abbreviation: 'WALC', latitude: 40, longitude: -86, amenities: [] },
];

describe('NotificationBell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders bell icon', async () => {
        axios.get.mockResolvedValue({ data: [] });

        render(<NotificationBell onSelectBuilding={vi.fn()} buildings={mockBuildings} />);

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith('/api/notifications');
        });
    });

    test('shows unread count badge when there are unread notifications', async () => {
        axios.get.mockResolvedValue({
            data: [
                { _id: 'n1', message: 'WALC 1018 is under 50%', read: false, buildingId: 'b1', createdAt: new Date().toISOString() },
                { _id: 'n2', message: 'WALC 2051 is under 30%', read: false, buildingId: 'b1', createdAt: new Date().toISOString() },
            ],
        });

        render(<NotificationBell onSelectBuilding={vi.fn()} buildings={mockBuildings} />);

        await waitFor(() => {
            expect(screen.getByText('2')).toBeDefined();
        });
    });

    test('does not show badge when all notifications are read', async () => {
        axios.get.mockResolvedValue({
            data: [
                { _id: 'n1', message: 'Old alert', read: true, buildingId: 'b1', createdAt: new Date().toISOString() },
            ],
        });

        render(<NotificationBell onSelectBuilding={vi.fn()} buildings={mockBuildings} />);

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalled();
        });

        expect(screen.queryByText('1')).toBeNull();
    });

    test('shows notification list when bell is clicked', async () => {
        axios.get.mockResolvedValue({
            data: [
                { _id: 'n1', message: 'WALC 1018 is under 50%', read: false, buildingId: 'b1', createdAt: new Date().toISOString() },
            ],
        });

        render(<NotificationBell onSelectBuilding={vi.fn()} buildings={mockBuildings} />);

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalled();
        });

        const bell = screen.getByRole('button');
        await userEvent.click(bell);

        expect(screen.getByText('Notifications')).toBeDefined();
        expect(screen.getByText(/WALC 1018/)).toBeDefined();
    });
});