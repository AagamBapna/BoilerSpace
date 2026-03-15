import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import AvailabilityEditor from '../components/AvailabilityEditor';

vi.mock('axios');

// Helpers
function renderEditor() {
    render(<AvailabilityEditor />);
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('AvailabilityEditor', () => {
    describe('Loading & Rendering', () => {
        test('shows loading state initially', () => {
            axios.get.mockReturnValue(new Promise(() => {}));
            renderEditor();
            expect(screen.getByText('Loading availability...')).toBeInTheDocument();
        });

        test('renders all 7 day labels after loading', async () => {
            axios.get.mockResolvedValue({ data: [] });
            renderEditor();
            await waitFor(() => {
                expect(screen.getByText('Mon')).toBeInTheDocument();
            });
            expect(screen.getByText('Tue')).toBeInTheDocument();
            expect(screen.getByText('Wed')).toBeInTheDocument();
            expect(screen.getByText('Thu')).toBeInTheDocument();
            expect(screen.getByText('Fri')).toBeInTheDocument();
            expect(screen.getByText('Sat')).toBeInTheDocument();
            expect(screen.getByText('Sun')).toBeInTheDocument();
        });

        test('shows "No time slots" for each day when empty', async () => {
            axios.get.mockResolvedValue({ data: [] });
            renderEditor();
            await waitFor(() => {
                const noSlots = screen.getAllByText('No time slots');
                expect(noSlots).toHaveLength(7);
            });
        });

        test('renders existing availability slots on load', async () => {
            axios.get.mockResolvedValue({
                data: [
                    { day: 'Monday', startTime: '09:00', endTime: '12:00' },
                ],
            });
            renderEditor();
            await waitFor(() => {
                const startInputs = screen.getAllByLabelText('Start time for Monday');
                expect(startInputs).toHaveLength(1);
                expect(startInputs[0]).toHaveValue('09:00');
            });
        });

        test('shows error when fetch fails', async () => {
            axios.get.mockRejectedValue(new Error('Network error'));
            renderEditor();
            await waitFor(() => {
                expect(screen.getByText('Failed to load availability')).toBeInTheDocument();
            });
        });
    });

    describe('Adding & Removing Slots', () => {
        test('clicking "+ Add slot" adds a time slot row for that day', async () => {
            axios.get.mockResolvedValue({ data: [] });
            const user = userEvent.setup();
            renderEditor();
            await waitFor(() => {
                expect(screen.getByText('Mon')).toBeInTheDocument();
            });

            const addBtn = screen.getByLabelText('Add time slot for Monday');
            await user.click(addBtn);

            expect(screen.getByLabelText('Start time for Monday')).toBeInTheDocument();
            expect(screen.getByLabelText('End time for Monday')).toBeInTheDocument();
        });

        test('clicking remove button removes the time slot', async () => {
            axios.get.mockResolvedValue({
                data: [{ day: 'Tuesday', startTime: '10:00', endTime: '14:00' }],
            });
            const user = userEvent.setup();
            renderEditor();
            await waitFor(() => {
                expect(screen.getByLabelText('Start time for Tuesday')).toBeInTheDocument();
            });

            const removeBtn = screen.getByLabelText('Remove time slot for Tuesday');
            await user.click(removeBtn);

            expect(screen.queryByLabelText('Start time for Tuesday')).not.toBeInTheDocument();
        });
    });

    describe('Saving', () => {
        test('clicking Save calls PUT with availability data', async () => {
            axios.get.mockResolvedValue({
                data: [{ day: 'Monday', startTime: '09:00', endTime: '12:00' }],
            });
            axios.put.mockResolvedValue({
                data: {
                    message: 'Availability updated',
                    availability: [{ day: 'Monday', startTime: '09:00', endTime: '12:00' }],
                },
            });
            const user = userEvent.setup();
            renderEditor();
            await waitFor(() => {
                expect(screen.getByText('Save Availability')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save Availability'));

            expect(axios.put).toHaveBeenCalledWith('/api/users/me/availability', {
                availability: [{ day: 'Monday', startTime: '09:00', endTime: '12:00' }],
            });
        });

        test('shows success message after save', async () => {
            axios.get.mockResolvedValue({ data: [] });
            axios.put.mockResolvedValue({
                data: { message: 'Availability updated', availability: [] },
            });
            const user = userEvent.setup();
            renderEditor();
            await waitFor(() => {
                expect(screen.getByText('Save Availability')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save Availability'));

            await waitFor(() => {
                expect(screen.getByText('Availability saved!')).toBeInTheDocument();
            });
        });

        test('shows validation errors from API on save failure', async () => {
            axios.get.mockResolvedValue({ data: [] });
            axios.put.mockRejectedValue({
                response: {
                    status: 400,
                    data: {
                        error: 'Invalid availability',
                        details: ['Slot 1: startTime must be before endTime'],
                    },
                },
            });
            const user = userEvent.setup();
            renderEditor();
            await waitFor(() => {
                expect(screen.getByText('Save Availability')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save Availability'));

            await waitFor(() => {
                expect(screen.getByText('Slot 1: startTime must be before endTime')).toBeInTheDocument();
            });
        });

        test('shows generic error on non-400 failure', async () => {
            axios.get.mockResolvedValue({ data: [] });
            axios.put.mockRejectedValue({
                response: { status: 500, data: { error: 'Server error' } },
            });
            const user = userEvent.setup();
            renderEditor();
            await waitFor(() => {
                expect(screen.getByText('Save Availability')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save Availability'));

            await waitFor(() => {
                expect(screen.getByText('Server error')).toBeInTheDocument();
            });
        });
    });
});
