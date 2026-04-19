import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationPreferences from '../components/NotificationPreferences';
import axios from 'axios';

vi.mock('axios', () => ({
    default: {
        put: vi.fn(),
        defaults: { headers: { common: {} } },
    },
}));

const defaultUser = {
    _id: 'user1',
    notificationSettings: {
        sessionReminders: true,
        messages: true,
        events: true,
        organizationUpdates: true,
        globalMute: false,
    },
};

describe('NotificationPreferences', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders all 5 toggle switches', () => {
        render(<NotificationPreferences userId="user1" user={defaultUser} onUserUpdate={vi.fn()} />);

        expect(screen.getByLabelText('Session Reminders')).toBeDefined();
        expect(screen.getByLabelText('Messages')).toBeDefined();
        expect(screen.getByLabelText('Events')).toBeDefined();
        expect(screen.getByLabelText('Organization Updates')).toBeDefined();
        expect(screen.getByLabelText('Mute All Notifications')).toBeDefined();
    });

    test('toggles call the API with correct payload', async () => {
        axios.put.mockResolvedValue({
            data: {
                notificationSettings: { ...defaultUser.notificationSettings, messages: false },
            },
        });

        const onUserUpdate = vi.fn();
        render(<NotificationPreferences userId="user1" user={defaultUser} onUserUpdate={onUserUpdate} />);

        const messagesToggle = screen.getByLabelText('Messages');
        await userEvent.click(messagesToggle);

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                '/api/users/user1/notifications/preferences',
                { messages: false }
            );
        });

        expect(onUserUpdate).toHaveBeenCalled();
    });

    test('Mute All disables individual toggles', () => {
        const mutedUser = {
            ...defaultUser,
            notificationSettings: { ...defaultUser.notificationSettings, globalMute: true },
        };

        render(<NotificationPreferences userId="user1" user={mutedUser} onUserUpdate={vi.fn()} />);

        const sessionsToggle = screen.getByLabelText('Session Reminders');
        const messagesToggle = screen.getByLabelText('Messages');
        const eventsToggle = screen.getByLabelText('Events');
        const orgToggle = screen.getByLabelText('Organization Updates');

        expect(sessionsToggle.disabled).toBe(true);
        expect(messagesToggle.disabled).toBe(true);
        expect(eventsToggle.disabled).toBe(true);
        expect(orgToggle.disabled).toBe(true);
    });

    test('shows error message when API call fails', async () => {
        axios.put.mockRejectedValue({
            response: { data: { error: 'Failed to update preference' } },
        });

        render(<NotificationPreferences userId="user1" user={defaultUser} onUserUpdate={vi.fn()} />);

        const messagesToggle = screen.getByLabelText('Messages');
        await userEvent.click(messagesToggle);

        await waitFor(() => {
            expect(screen.getByText('Failed to update preference')).toBeDefined();
        });
    });

    test('rolls back toggle state on API error', async () => {
        axios.put.mockRejectedValue({
            response: { data: { error: 'Server error' } },
        });

        render(<NotificationPreferences userId="user1" user={defaultUser} onUserUpdate={vi.fn()} />);

        const messagesToggle = screen.getByLabelText('Messages');
        // Messages starts as checked (true)
        expect(messagesToggle.getAttribute('aria-checked')).toBe('true');

        await userEvent.click(messagesToggle);

        // After error, should roll back to true
        await waitFor(() => {
            expect(messagesToggle.getAttribute('aria-checked')).toBe('true');
        });
    });

    test('renders with default values when notificationSettings is undefined', () => {
        const userNoSettings = { _id: 'user1' };

        render(<NotificationPreferences userId="user1" user={userNoSettings} onUserUpdate={vi.fn()} />);

        const sessionsToggle = screen.getByLabelText('Session Reminders');
        expect(sessionsToggle.getAttribute('aria-checked')).toBe('true');

        const muteToggle = screen.getByLabelText('Mute All Notifications');
        expect(muteToggle.getAttribute('aria-checked')).toBe('false');
    });
});
