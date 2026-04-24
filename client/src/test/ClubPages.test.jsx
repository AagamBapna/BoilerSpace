import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';
import axios from 'axios';
import ClubList from '../pages/ClubList';
import ClubProfile from '../pages/ClubProfile';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

function NoticeView() {
  const location = useLocation();
  return <div>{location.state?.notice || 'no-notice'}</div>;
}

function EventRouteView() {
  const params = useParams();
  return <div>{`event-route:${params.id}`}</div>;
}

describe('ClubList create popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('posts organizerIds from logged-in user and navigates with confirmation notice', async () => {
    const user = userEvent.setup({ delay: null });

    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs') return Promise.resolve({ data: [] });
      if (url === '/api/users/user-1') return Promise.resolve({ data: { clubIds: [] } });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    axios.post.mockResolvedValueOnce({ data: { id: 'club-1' } });

    render(
      <MemoryRouter initialEntries={['/clubs']}>
        <Routes>
          <Route path="/clubs" element={<ClubList user={{ id: 'user-1' }} />} />
          <Route path="/clubs/:id" element={<NoticeView />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: '+ Create Club' }));
    await user.type(screen.getByPlaceholderText('e.g. Purdue Robotics Club'), 'Robotics Club');
    await user.type(screen.getByPlaceholderText('What does your club do?'), 'We build robots.');
    await user.type(screen.getByPlaceholderText('e.g. Engineering, Arts, Sports'), 'Engineering');
    await user.type(screen.getByPlaceholderText('e.g. email@purdue.edu'), 'robotics@purdue.edu');
    await user.click(screen.getByRole('button', { name: 'Create Club' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/clubs', {
        name: 'Robotics Club',
        description: 'We build robots.',
        contactInfo: 'robotics@purdue.edu',
        category: 'Engineering',
        organizerIds: ['user-1'],
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Club created successfully.')).toBeInTheDocument();
    });
  });
});

describe('ClubProfile page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('does not show organizer dashboard button for non-organizer', async () => {
    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users/other-user') {
        return Promise.resolve({ data: { clubIds: [] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'other-user' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    expect(screen.queryByRole('button', { name: 'Organizer Dashboard' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request to Join' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Club' })).not.toBeInTheDocument();
  });

  test('shows organizer dashboard button for organizer', async () => {
    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users/owner-1') {
        return Promise.resolve({ data: { clubIds: ['club-1'] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'owner-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    expect(screen.getByRole('button', { name: 'Organizer Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request to Join' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Club' })).not.toBeInTheDocument();
  });

  test('shows organizer dashboard button for officer', async () => {
    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users/officer-1') {
        return Promise.resolve({ data: { clubIds: ['club-1'] } });
      }
      if (url === '/api/clubs/club-1/access') {
        return Promise.resolve({ data: { role: 'officer', position: 'Member', isOrganizer: false } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'officer-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    expect(screen.getByRole('button', { name: 'Organizer Dashboard' })).toBeInTheDocument();
  });

  test('shows the create event modal for an organizer user with only _id', async () => {
    const user = userEvent.setup();

    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users/owner-1') {
        return Promise.resolve({ data: { clubIds: ['club-1'] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ _id: 'owner-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    await user.click(screen.getByRole('button', { name: 'Create Event' }));

    expect(screen.getByRole('heading', { name: 'Create Event' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Event title')).toBeInTheDocument();
  });

  test('shows inline modal error when creating an event with missing fields', async () => {
    const user = userEvent.setup();

    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users/owner-1') {
        return Promise.resolve({ data: { clubIds: ['club-1'] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'owner-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    await user.click(screen.getByRole('button', { name: 'Create Event' }));
    await user.click(screen.getAllByRole('button', { name: 'Create Event' })[1]);

    expect(screen.getByText('All event fields are required.')).toBeInTheDocument();
  });

  test('requests membership from profile when user is not already a member', async () => {
    const user = userEvent.setup();

    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users/student-1') {
        return Promise.resolve({ data: { clubIds: [], pendingClubIds: [], removedClubIds: [] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });
    axios.post.mockResolvedValueOnce({ data: { success: true, pendingRequest: true } });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'student-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    await user.click(screen.getByRole('button', { name: 'Request to Join' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/clubs/club-1/join');
    });
    expect(screen.getByText('Your join request has been sent.')).toBeInTheDocument();
  });

  test('allows removed users to request to rejoin from profile', async () => {
    const user = userEvent.setup();

    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users/student-1') {
        return Promise.resolve({ data: { clubIds: [], pendingClubIds: [], removedClubIds: ['club-1'] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    axios.post.mockResolvedValueOnce({ data: { success: true, pendingRequest: true } });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'student-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    await user.click(screen.getByRole('button', { name: 'Request to Rejoin' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/clubs/club-1/join');
    });
    expect(screen.getByText('Your rejoin request has been sent.')).toBeInTheDocument();
  });

  test('shows leave club button for members and leaves successfully', async () => {
    const user = userEvent.setup();
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = vi.fn(() => true);

    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({ data: [] });
      }
      if (url === '/api/users/student-1') {
        return Promise.resolve({ data: { clubIds: ['club-1'], pendingClubIds: [], removedClubIds: [] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    axios.post.mockResolvedValueOnce({ data: { success: true } });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'student-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    expect(screen.getByRole('button', { name: 'Leave Club' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Leave Club' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/clubs/club-1/leave');
    });
    expect(screen.getByText('You left this club.')).toBeInTheDocument();
    globalThis.confirm = originalConfirm;
  });

  test('renders monthly calendar with events and opens event detail on click', async () => {
    const user = userEvent.setup();

    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({
          data: [
            {
              id: 'event-1',
              title: 'Hack Night',
              description: 'Build stuff',
              date: '2026-04-14',
              time: '19:00',
              location: 'LWSN',
              recurrence: { type: 'weekly', interval: 1, endDate: '2026-05-12', recurrenceGroupId: 'series-1' },
            },
            {
              id: 'event-2',
              title: 'Workshop',
              description: 'Learn stuff',
              date: '2026-04-14',
              time: '20:00',
              location: 'WALC',
              recurrence: { type: 'none', interval: 1, endDate: null, recurrenceGroupId: null },
            },
          ],
        });
      }
      if (url === '/api/users/owner-1') {
        return Promise.resolve({ data: { clubIds: ['club-1'] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'owner-1' }} />} />
          <Route path="/events/:id" element={<EventRouteView />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Monthly View');
    expect(screen.getByText('Hack Night')).toBeInTheDocument();
    expect(screen.getByText('Workshop')).toBeInTheDocument();
    expect(screen.getAllByText('Hack Night').length).toBeGreaterThan(1);

    await user.click(screen.getAllByText('Hack Night')[0]);
    await waitFor(() => {
      expect(screen.getByText('event-route:event-1')).toBeInTheDocument();
    });
  });

  test('shows only one list item for a recurring series and labels it recurring', async () => {
    axios.get.mockImplementation((url) => {
      if (url === '/api/clubs/club-1') {
        return Promise.resolve({
          data: {
            id: 'club-1',
            name: 'CS Club',
            description: 'Tech org',
            category: 'Academic',
            contactInfo: 'cs@example.com',
            organizerIds: ['owner-1'],
            pendingMemberIds: [],
          },
        });
      }
      if (url === '/api/events?clubId=club-1') {
        return Promise.resolve({
          data: [
            {
              id: 'event-1',
              title: 'Weekly Standup',
              description: 'Recurring sync',
              date: '2099-04-01',
              time: '18:00',
              location: 'LWSN',
              recurrence: { type: 'weekly', interval: 1, endDate: '2099-04-29', recurrenceGroupId: 'series-1' },
            },
            {
              id: 'event-2',
              title: 'Weekly Standup',
              description: 'Recurring sync',
              date: '2099-04-08',
              time: '18:00',
              location: 'LWSN',
              recurrence: { type: 'weekly', interval: 1, endDate: '2099-04-29', recurrenceGroupId: 'series-1' },
            },
            {
              id: 'event-3',
              title: 'Workshop',
              description: 'One-time event',
              date: '2099-04-10',
              time: '19:00',
              location: 'WALC',
              recurrence: { type: 'none', interval: 1, endDate: null, recurrenceGroupId: null },
            },
          ],
        });
      }
      if (url === '/api/users/owner-1') {
        return Promise.resolve({ data: { clubIds: ['club-1'] } });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'owner-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Monthly View');
    expect(screen.getAllByText('Weekly Standup').length).toBe(2);
    expect(screen.getByText('Workshop')).toBeInTheDocument();
    expect(screen.getByText(/Recurring •/)).toBeInTheDocument();
  });
});
