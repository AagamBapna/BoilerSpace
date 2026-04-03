import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SnackIndicator from '../components/SnackIndicator';
import SnackReporter from '../components/SnackReporter';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: {} })),
        post: vi.fn(() => Promise.resolve({ data: { cafeScore: 100, vendingScore: 0, cafeCount: 1, vendingCount: 0, lastSnackReportAt: new Date().toISOString() } })),
    },
}));

describe('SnackIndicator', () => {
    test('renders cafe icon green (opacity 1) when cafeScore >= 60%', () => {
        const data = { cafeScore: 80, vendingScore: 20, cafeCount: 5, vendingCount: 3 };
        const { container } = render(
            <SnackIndicator snackData={data} onOpenReporter={vi.fn()} />
        );

        const spans = container.querySelectorAll('span');
        // First span is the cafe icon wrapper
        const cafeSpan = spans[0];
        expect(cafeSpan.style.opacity).toBe('1');
        expect(screen.getByText('80%')).toBeInTheDocument();
    });

    test('renders vending icon gray (opacity 0.5) when vendingScore < 60%', () => {
        const data = { cafeScore: 80, vendingScore: 20, cafeCount: 5, vendingCount: 3 };
        const { container } = render(
            <SnackIndicator snackData={data} onOpenReporter={vi.fn()} />
        );

        const spans = container.querySelectorAll('span');
        // Second span is the vending icon wrapper
        const vendingSpan = spans[2]; // index 2 because cafe % text is index 1
        expect(vendingSpan.style.opacity).toBe('0.5');
        expect(screen.getByText('20%')).toBeInTheDocument();
    });

    test('renders both icons gray when no data (count == 0)', () => {
        const data = { cafeScore: 0, vendingScore: 0, cafeCount: 0, vendingCount: 0 };
        const { container } = render(
            <SnackIndicator snackData={data} onOpenReporter={vi.fn()} />
        );

        const spans = container.querySelectorAll('span');
        expect(spans[0].style.opacity).toBe('0.5');
        expect(spans[1].style.opacity).toBe('0.5');
        // No percentages shown when count is 0
        expect(screen.queryByText('%')).toBeNull();
    });

    test('renders gray icons when snackData is null', () => {
        const { container } = render(
            <SnackIndicator snackData={null} onOpenReporter={vi.fn()} />
        );

        const spans = container.querySelectorAll('span');
        expect(spans[0].style.opacity).toBe('0.5');
        expect(spans[1].style.opacity).toBe('0.5');
    });

    test('calls onOpenReporter when clicked', () => {
        const handler = vi.fn();
        const { container } = render(
            <SnackIndicator snackData={null} onOpenReporter={handler} />
        );

        fireEvent.click(container.firstChild);
        expect(handler).toHaveBeenCalledTimes(1);
    });
});

describe('SnackReporter', () => {
    test('renders Present and Not present buttons for cafe and vending', () => {
        render(
            <SnackReporter
                buildingId="b1"
                snackData={{ cafeScore: 0, vendingScore: 0, cafeCount: 0, vendingCount: 0, recentReports: [] }}
                user={{ _id: 'u1' }}
                onUpdate={vi.fn()}
                onClose={vi.fn()}
            />
        );

        const presentButtons = screen.getAllByText('Present');
        const notPresentButtons = screen.getAllByText('Not present');
        expect(presentButtons).toHaveLength(2); // cafe + vending
        expect(notPresentButtons).toHaveLength(2);
    });

    test('shows "No reports" when counts are 0', () => {
        render(
            <SnackReporter
                buildingId="b1"
                snackData={{ cafeScore: 0, vendingScore: 0, cafeCount: 0, vendingCount: 0, recentReports: [] }}
                user={{ _id: 'u1' }}
                onUpdate={vi.fn()}
                onClose={vi.fn()}
            />
        );

        const noReports = screen.getAllByText('No reports');
        expect(noReports).toHaveLength(2);
    });

    test('shows score and count when reports exist', () => {
        render(
            <SnackReporter
                buildingId="b1"
                snackData={{ cafeScore: 75, vendingScore: 40, cafeCount: 4, vendingCount: 5, recentReports: [] }}
                user={{ _id: 'u1' }}
                onUpdate={vi.fn()}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText(/75% \(4 reports\)/)).toBeInTheDocument();
        expect(screen.getByText(/40% \(5 reports\)/)).toBeInTheDocument();
    });

    test('calls onClose when x button is clicked', () => {
        const closeFn = vi.fn();
        render(
            <SnackReporter
                buildingId="b1"
                snackData={{ cafeScore: 0, vendingScore: 0, cafeCount: 0, vendingCount: 0, recentReports: [] }}
                user={{ _id: 'u1' }}
                onUpdate={vi.fn()}
                onClose={closeFn}
            />
        );

        fireEvent.click(screen.getByText('x'));
        expect(closeFn).toHaveBeenCalledTimes(1);
    });

    test('shows error when user is not authenticated', async () => {
        render(
            <SnackReporter
                buildingId="b1"
                snackData={{ cafeScore: 0, vendingScore: 0, cafeCount: 0, vendingCount: 0, recentReports: [] }}
                user={null}
                onUpdate={vi.fn()}
                onClose={vi.fn()}
            />
        );

        fireEvent.click(screen.getAllByText('Present')[0]);
        expect(await screen.findByText('Sign in to report')).toBeInTheDocument();
    });

    test('calls POST and onUpdate on successful submit', async () => {
        const axios = (await import('axios')).default;
        const updateFn = vi.fn();

        render(
            <SnackReporter
                buildingId="b1"
                snackData={{ cafeScore: 0, vendingScore: 0, cafeCount: 0, vendingCount: 0, recentReports: [] }}
                user={{ _id: 'u1' }}
                onUpdate={updateFn}
                onClose={vi.fn()}
            />
        );

        fireEvent.click(screen.getAllByText('Present')[0]);

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/buildings/b1/snacks', { type: 'cafe', value: true });
            expect(updateFn).toHaveBeenCalled();
        });
    });

    test('shows duplicate error on 409 response', async () => {
        const axios = (await import('axios')).default;
        axios.post.mockRejectedValueOnce({
            response: { status: 409, data: { error: 'You recently reported this' } },
        });

        render(
            <SnackReporter
                buildingId="b1"
                snackData={{ cafeScore: 0, vendingScore: 0, cafeCount: 0, vendingCount: 0, recentReports: [] }}
                user={{ _id: 'u1' }}
                onUpdate={vi.fn()}
                onClose={vi.fn()}
            />
        );

        fireEvent.click(screen.getAllByText('Present')[0]);
        expect(await screen.findByText('You recently reported this')).toBeInTheDocument();
    });
});
