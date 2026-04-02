import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import ClassmateDiscovery from '../components/ClassmateDiscovery';
import FriendRequests from '../components/FriendRequests';
import FriendsList from '../components/FriendsList';
import ClassmateProfile from '../components/ClassmateProfile';

vi.mock('axios');

const mockClassmatesData = [
    {
        courseId: 'course1',
        courseCode: 'CS101',
        courseTitle: 'Intro to CS',
        classmates: [
            {
                _id: 'user2',
                displayName: 'Bob',
                major: 'CS',
                year: 'Senior',
                profilePictureUrl: '',
                friendship: null,
            },
            {
                _id: 'user3',
                displayName: 'Carol',
                major: 'ECE',
                year: 'Junior',
                profilePictureUrl: 'https://example.com/carol.jpg',
                friendship: { id: 'f1', status: 'pending', direction: 'outgoing' },
            },
        ],
    },
];

const mockPendingData = {
    incoming: [
        {
            _id: 'req1',
            requester: { _id: 'user4', displayName: 'Dave', major: 'ME', year: 'Freshman', profilePictureUrl: '' },
        },
    ],
    outgoing: [
        {
            _id: 'req2',
            recipient: { _id: 'user5', displayName: 'Eve', major: 'CS', year: 'Senior', profilePictureUrl: '' },
        },
    ],
};

const mockFriendsData = [
    { friendshipId: 'f2', _id: 'user6', displayName: 'Frank', major: 'CS', year: 'Junior', profilePictureUrl: '' },
    { friendshipId: 'f3', _id: 'user7', displayName: 'Grace', major: 'Math', year: 'Senior', profilePictureUrl: '' },
];

// ── ClassmateDiscovery ──────────────────────────────────────

describe('ClassmateDiscovery', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders loading spinner initially', () => {
        axios.get.mockReturnValue(new Promise(() => {}));
        const { container } = render(
            <ClassmateDiscovery onClose={vi.fn()} onViewProfile={vi.fn()} />
        );
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('displays classmates grouped by course', async () => {
        axios.get.mockResolvedValueOnce({ data: mockClassmatesData });
        render(<ClassmateDiscovery onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('CS101 — Intro to CS')).toBeInTheDocument();
            expect(screen.getByText('Bob')).toBeInTheDocument();
            expect(screen.getByText('Carol')).toBeInTheDocument();
        });
    });

    it('shows "Add Friend" for classmates with no friendship', async () => {
        axios.get.mockResolvedValueOnce({ data: mockClassmatesData });
        render(<ClassmateDiscovery onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Add Friend')).toBeInTheDocument();
        });
    });

    it('shows "Pending" for outgoing pending requests', async () => {
        axios.get.mockResolvedValueOnce({ data: mockClassmatesData });
        render(<ClassmateDiscovery onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Pending')).toBeInTheDocument();
        });
    });

    it('shows empty state when no classmates found', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<ClassmateDiscovery onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('No classmates found.')).toBeInTheDocument();
        });
    });

    it('calls onViewProfile when clicking a classmate name', async () => {
        axios.get.mockResolvedValueOnce({ data: mockClassmatesData });
        const onViewProfile = vi.fn();
        render(<ClassmateDiscovery onClose={vi.fn()} onViewProfile={onViewProfile} />);

        await waitFor(() => screen.getByText('Bob'));
        fireEvent.click(screen.getByText('Bob'));
        expect(onViewProfile).toHaveBeenCalledWith('user2');
    });

    it('calls onClose when clicking close button', async () => {
        axios.get.mockResolvedValueOnce({ data: mockClassmatesData });
        const onClose = vi.fn();
        render(<ClassmateDiscovery onClose={onClose} onViewProfile={vi.fn()} />);

        await waitFor(() => screen.getByText('Bob'));
        const closeBtn = screen.getByText('Classmates').closest('div').parentElement.querySelector('button');
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalled();
    });

    it('sends friend request when clicking Add Friend', async () => {
        axios.get.mockResolvedValueOnce({ data: mockClassmatesData });
        axios.post.mockResolvedValueOnce({ data: {} });
        axios.get.mockResolvedValueOnce({ data: mockClassmatesData });

        render(<ClassmateDiscovery onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => screen.getByText('Add Friend'));
        fireEvent.click(screen.getByText('Add Friend'));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/friendships/request', { recipientId: 'user2' });
        });
    });
});

// ── FriendRequests ──────────────────────────────────────────

describe('FriendRequests', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders incoming requests by default', async () => {
        axios.get.mockResolvedValueOnce({ data: mockPendingData });
        render(<FriendRequests onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Dave')).toBeInTheDocument();
            expect(screen.getByText('Accept')).toBeInTheDocument();
            expect(screen.getByText('Reject')).toBeInTheDocument();
        });
    });

    it('switches to outgoing tab', async () => {
        axios.get.mockResolvedValueOnce({ data: mockPendingData });
        render(<FriendRequests onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => screen.getByText('Dave'));
        fireEvent.click(screen.getByText(/^Outgoing/));

        expect(screen.getByText('Eve')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('calls accept endpoint when clicking Accept', async () => {
        axios.get.mockResolvedValueOnce({ data: mockPendingData });
        axios.put.mockResolvedValueOnce({ data: {} });
        axios.get.mockResolvedValueOnce({ data: { incoming: [], outgoing: [] } });

        render(<FriendRequests onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => screen.getByText('Accept'));
        fireEvent.click(screen.getByText('Accept'));

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith('/api/friendships/req1/accept');
        });
    });

    it('calls reject endpoint when clicking Reject', async () => {
        axios.get.mockResolvedValueOnce({ data: mockPendingData });
        axios.put.mockResolvedValueOnce({ data: {} });
        axios.get.mockResolvedValueOnce({ data: { incoming: [], outgoing: [] } });

        render(<FriendRequests onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => screen.getByText('Reject'));
        fireEvent.click(screen.getByText('Reject'));

        await waitFor(() => {
            expect(axios.put).toHaveBeenCalledWith('/api/friendships/req1/reject');
        });
    });

    it('calls delete endpoint when clicking Cancel on outgoing', async () => {
        axios.get.mockResolvedValueOnce({ data: mockPendingData });
        render(<FriendRequests onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => screen.getByText('Dave'));
        fireEvent.click(screen.getByText(/^Outgoing/));

        axios.delete.mockResolvedValueOnce({ data: {} });
        axios.get.mockResolvedValueOnce({ data: { incoming: [], outgoing: [] } });

        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(axios.delete).toHaveBeenCalledWith('/api/friendships/req2');
        });
    });
});

// ── FriendsList ─────────────────────────────────────────────

describe('FriendsList', () => {
    beforeEach(() => vi.clearAllMocks());

    it('displays friends list', async () => {
        axios.get.mockResolvedValueOnce({ data: mockFriendsData });
        render(<FriendsList onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Frank')).toBeInTheDocument();
            expect(screen.getByText('Grace')).toBeInTheDocument();
            expect(screen.getByText('2 friends')).toBeInTheDocument();
        });
    });

    it('shows empty state when no friends', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<FriendsList onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('No friends yet.')).toBeInTheDocument();
        });
    });

    it('calls delete endpoint when clicking Unfriend', async () => {
        axios.get.mockResolvedValueOnce({ data: mockFriendsData });
        axios.delete.mockResolvedValueOnce({ data: {} });
        axios.get.mockResolvedValueOnce({ data: [] });

        render(<FriendsList onClose={vi.fn()} onViewProfile={vi.fn()} />);

        await waitFor(() => screen.getByText('Frank'));
        fireEvent.click(screen.getAllByText('Unfriend')[0]);

        await waitFor(() => {
            expect(axios.delete).toHaveBeenCalledWith('/api/friendships/f2');
        });
    });

    it('calls onViewProfile when clicking a friend', async () => {
        axios.get.mockResolvedValueOnce({ data: mockFriendsData });
        const onViewProfile = vi.fn();
        render(<FriendsList onClose={vi.fn()} onViewProfile={onViewProfile} />);

        await waitFor(() => screen.getByText('Frank'));
        fireEvent.click(screen.getByText('Frank'));
        expect(onViewProfile).toHaveBeenCalledWith('user6');
    });
});

// ── ClassmateProfile ────────────────────────────────────────

describe('ClassmateProfile', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders loading spinner initially', () => {
        axios.get.mockReturnValue(new Promise(() => {}));
        const { container } = render(
            <ClassmateProfile userId="user2" onClose={vi.fn()} />
        );
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('displays full profile for public user', async () => {
        axios.get.mockImplementation((url) => {
            if (url === '/api/users/user2') {
                return Promise.resolve({
                    data: {
                        _id: 'user2',
                        displayName: 'Bob',
                        major: 'CS',
                        year: 'Senior',
                        profilePictureUrl: '',
                        profileVisibility: 'public',
                        courses: [{ _id: 'c1', courseCode: 'CS101' }],
                        availability: [{ day: 'Monday', startTime: '10:00', endTime: '12:00' }],
                    },
                });
            }
            if (url === '/api/friendships/classmates') return Promise.resolve({ data: [] });
            if (url === '/api/friendships/pending') return Promise.resolve({ data: { incoming: [], outgoing: [] } });
            if (url === '/api/friendships/friends') return Promise.resolve({ data: [] });
            return Promise.reject(new Error(`Unexpected: ${url}`));
        });

        render(<ClassmateProfile userId="user2" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Bob')).toBeInTheDocument();
            expect(screen.getByText('CS')).toBeInTheDocument();
            expect(screen.getByText('Senior')).toBeInTheDocument();
            expect(screen.getByText('CS101')).toBeInTheDocument();
            expect(screen.getByText('Monday')).toBeInTheDocument();
            expect(screen.getByText('Add Friend')).toBeInTheDocument();
        });
    });

    it('displays limited info for private user', async () => {
        axios.get.mockImplementation((url) => {
            if (url === '/api/users/user3') {
                return Promise.resolve({
                    data: {
                        _id: 'user3',
                        displayName: 'Charlie',
                        profilePictureUrl: '',
                        profileVisibility: 'private',
                    },
                });
            }
            if (url === '/api/friendships/classmates') return Promise.resolve({ data: [] });
            if (url === '/api/friendships/pending') return Promise.resolve({ data: { incoming: [], outgoing: [] } });
            if (url === '/api/friendships/friends') return Promise.resolve({ data: [] });
            return Promise.reject(new Error(`Unexpected: ${url}`));
        });

        render(<ClassmateProfile userId="user3" onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Charlie')).toBeInTheDocument();
            expect(screen.getByText('This profile is private.')).toBeInTheDocument();
        });
    });
});
