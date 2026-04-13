import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PublicProfile from '../components/PublicProfile';

vi.mock('axios');

vi.mock('../components/CourseSelector', () => ({
    default: () => <div data-testid="course-selector-mock">CourseSelector</div>
}));

vi.mock('../components/AvailabilityEditor', () => ({
    default: () => <div data-testid="availability-editor-mock">AvailabilityEditor</div>
}));

const mockSelfUser = { id: 'user1', displayName: 'Self User' };

describe('PublicProfile Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderWithRouter = (userId, userProps = {}) => {
        return render(
            <MemoryRouter initialEntries={[`/profile/${userId}`]}>
                <Routes>
                    <Route path="/profile/:userId" element={<PublicProfile user={userProps.user} onUserUpdate={userProps.onUserUpdate} />} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('renders self profile and allows editing', async () => {
        axios.get.mockResolvedValueOnce({
            data: { _id: 'user1', displayName: 'Self User', bio: 'My bio', major: 'CS', year: 'Freshman', connectionStatus: 'none' }
        });

        renderWithRouter('user1', { user: mockSelfUser });

        await waitFor(() => {
            expect(screen.getByText('Self User')).toBeInTheDocument();
            expect(screen.getByText('My bio')).toBeInTheDocument();
        });

        // Click Edit Profile
        const editBtn = screen.getByText('Edit Profile');
        fireEvent.click(editBtn);

        // Should see inputs
        const nameInput = screen.getByDisplayValue('Self User');
        expect(nameInput).toBeInTheDocument();
        const bioInput = screen.getByDisplayValue('My bio');
        expect(bioInput).toBeInTheDocument();

        // Check for course selector and availability mocks
        expect(screen.getByTestId('course-selector-mock')).toBeInTheDocument();
        expect(screen.getByTestId('availability-editor-mock')).toBeInTheDocument();
    });

    it('renders public profile of another user with connect button', async () => {
        axios.get.mockResolvedValueOnce({
            data: { _id: 'user2', displayName: 'Other User', profileVisibility: 'public', connectionStatus: 'none', courses: [{ _id: 'c1', courseCode: 'CS101' }] }
        });

        renderWithRouter('user2', { user: mockSelfUser });

        await waitFor(() => {
            expect(screen.getByText('Other User')).toBeInTheDocument();
            expect(screen.getByText('Connect')).toBeInTheDocument();
            expect(screen.getByText('CS101')).toBeInTheDocument();
            // Should not see Edit Profile
            expect(screen.queryByText('Edit Profile')).not.toBeInTheDocument();
        });

        // Click Connect
        axios.post.mockResolvedValueOnce({ data: { _id: 'friendship1' } });
        fireEvent.click(screen.getByText('Connect'));

        await waitFor(() => {
            expect(screen.getByText('Request Pending — Cancel')).toBeInTheDocument();
        });
    });

    it('renders private profile of another user', async () => {
        axios.get.mockResolvedValueOnce({
            data: { _id: 'user3', displayName: 'Private User', profileVisibility: 'private', connectionStatus: 'none' }
        });

        renderWithRouter('user3', { user: mockSelfUser });

        await waitFor(() => {
            expect(screen.getByText('Private User')).toBeInTheDocument();
            expect(screen.getByText('This profile is private.')).toBeInTheDocument();
            expect(screen.getByText('Send Friend Request')).toBeInTheDocument();
            expect(screen.queryByText('CS101')).not.toBeInTheDocument();
        });
    });

    it('displays pending incoming request and allows accept/decline', async () => {
        axios.get.mockResolvedValueOnce({
            data: { _id: 'user4', displayName: 'Request User', profileVisibility: 'public', connectionStatus: 'pending_incoming', friendshipId: 'f1' }
        });

        renderWithRouter('user4', { user: mockSelfUser });

        await waitFor(() => {
            expect(screen.getByText('Request User')).toBeInTheDocument();
            expect(screen.getByText('Accept Request')).toBeInTheDocument();
            expect(screen.getByText('Decline')).toBeInTheDocument();
        });

        axios.put.mockResolvedValueOnce({ data: {} });
        fireEvent.click(screen.getByText('Accept Request'));

        await waitFor(() => {
            expect(screen.getByText('Friends')).toBeInTheDocument();
        });
    });

    it('shows friends status and allows unfriend', async () => {
        axios.get.mockResolvedValueOnce({
            data: { _id: 'user5', displayName: 'Friend User', profileVisibility: 'public', connectionStatus: 'accepted', friendshipId: 'f2' }
        });

        renderWithRouter('user5', { user: mockSelfUser });

        await waitFor(() => {
            expect(screen.getByText('Friend User')).toBeInTheDocument();
            expect(screen.getByText('Friends')).toBeInTheDocument();
            expect(screen.getByText('Unfriend')).toBeInTheDocument();
        });

        axios.delete.mockResolvedValueOnce({ data: {} });
        fireEvent.click(screen.getByText('Unfriend'));

        await waitFor(() => {
            expect(screen.getByText('Connect')).toBeInTheDocument();
        });
    });
});
