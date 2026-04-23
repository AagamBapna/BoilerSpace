import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrivacySettings from '../components/PrivacySettings';
import axios from 'axios';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        put: vi.fn(),
        defaults: { headers: { common: {} } },
    },
}));

const baseUser = {
    profileVisibility: 'public',
    fieldVisibility: {
        email: 'private',
        major: 'public',
        year: 'public',
        bio: 'public',
        studyPreferences: 'public',
        interests: 'public',
        linkedResources: 'public',
        studyGoals: 'public',
        courses: 'public',
        availability: 'public',
        weeklyStudyGoalMinutes: 'public',
    },
};

describe('PrivacySettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('renders master toggle and all 11 per-field toggles when profile is public', () => {
        render(<PrivacySettings user={baseUser} onUpdate={vi.fn()} />);

        expect(screen.getByText('Profile is Public')).toBeDefined();

        const fieldLabels = [
            'Email address', 'Major', 'Year', 'Bio',
            'Study preferences', 'Interests', 'GitHub / LinkedIn',
            'Study goals', 'Courses', 'Study availability', 'Weekly study goal',
        ];
        for (const label of fieldLabels) {
            expect(screen.getByText(label)).toBeDefined();
        }
    });

    test('hides per-field toggles when master is private', () => {
        const privateUser = { ...baseUser, profileVisibility: 'private' };
        render(<PrivacySettings user={privateUser} onUpdate={vi.fn()} />);

        expect(screen.getByText('Profile is Private')).toBeDefined();
        expect(screen.queryByText('Per-field visibility (non-friends)')).toBeNull();
        expect(screen.queryByText('Bio')).toBeNull();
    });

    test('clicking master toggle issues PUT with inverted profileVisibility', async () => {
        axios.put.mockResolvedValue({
            data: {
                profileVisibility: 'private',
                fieldVisibility: baseUser.fieldVisibility,
            },
        });

        const onUpdate = vi.fn();
        render(<PrivacySettings user={baseUser} onUpdate={onUpdate} />);

        await userEvent.click(screen.getByLabelText(/Profile is Public: public/i));

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                '/api/users/me/visibility',
                { profileVisibility: 'private' },
            );
        });
        expect(onUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ profileVisibility: 'private' }),
        );
    });

    test('clicking a field toggle issues partial PUT for only that field', async () => {
        axios.put.mockResolvedValue({
            data: {
                profileVisibility: 'public',
                fieldVisibility: { ...baseUser.fieldVisibility, bio: 'private' },
            },
        });

        const onUpdate = vi.fn();
        render(<PrivacySettings user={baseUser} onUpdate={onUpdate} />);

        await userEvent.click(screen.getByLabelText(/Bio: public/i));

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith(
                '/api/users/me/visibility',
                { fieldVisibility: { bio: 'private' } },
            );
        });
        expect(onUpdate).toHaveBeenCalled();
    });

    test('rolls back optimistic update and shows error on API failure', async () => {
        axios.put.mockRejectedValue({
            response: { data: { error: 'Failed to update field visibility.' } },
        });

        render(<PrivacySettings user={baseUser} onUpdate={vi.fn()} />);

        const bioToggle = screen.getByLabelText(/Bio: public/i);
        expect(bioToggle.getAttribute('aria-pressed')).toBe('true');

        await userEvent.click(bioToggle);

        await waitFor(() => {
            expect(screen.getByText('Failed to update field visibility.')).toBeDefined();
        });
        // Value snapped back to public.
        expect(screen.getByLabelText(/Bio: public/i)).toBeDefined();
    });

    test('fetches /api/users/me/visibility when no fieldVisibility is provided via props', async () => {
        axios.get.mockResolvedValue({
            data: {
                profileVisibility: 'public',
                fieldVisibility: { ...baseUser.fieldVisibility },
            },
        });

        render(<PrivacySettings user={{ profileVisibility: 'public' }} onUpdate={vi.fn()} />);

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith('/api/users/me/visibility');
        });
        await waitFor(() => {
            expect(screen.getByText('Profile is Public')).toBeDefined();
        });
    });

    test('email toggle reflects private state by default', () => {
        render(<PrivacySettings user={baseUser} onUpdate={vi.fn()} />);

        const emailToggle = screen.getByLabelText(/Email address: private/i);
        expect(emailToggle.getAttribute('aria-pressed')).toBe('false');
    });
});
