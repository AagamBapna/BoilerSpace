import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import ClubOrganizerDashboard from '../pages/ClubOrganizerDashboard';

vi.mock('axios');

const clubId = 'club-1';

function mockDashboardRequests({ role = 'admin', members = [], positions = ['Member'], announcements = [], events = [] } = {}) {
  axios.get.mockImplementation((url) => {
    if (url === `/api/clubs/${clubId}`) {
      return Promise.resolve({
        data: {
          id: clubId,
          name: 'CS Club',
          description: 'Tech org',
          category: 'Academic',
          contactInfo: 'cs@example.com',
          organizerIds: ['owner-1'],
          pendingMemberIds: [],
        },
      });
    }

    if (url === `/api/clubs/${clubId}/access`) {
      return Promise.resolve({ data: { role } });
    }

    if (url === `/api/events?clubId=${clubId}`) {
      return Promise.resolve({ data: events });
    }

    if (url === `/api/clubs/${clubId}/announcements`) {
      return Promise.resolve({ data: announcements });
    }

    if (url === `/api/clubs/${clubId}/members`) {
      return Promise.resolve({ data: members });
    }

    if (url === `/api/clubs/${clubId}/pending-members`) {
      return Promise.resolve({ data: [] });
    }

    if (url === `/api/clubs/${clubId}/positions`) {
      return Promise.resolve({ data: { positions } });
    }

    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

function renderDashboard(user) {
  return render(
    <MemoryRouter initialEntries={[`/clubs/${clubId}/dashboard`]}>
      <Routes>
        <Route path="/clubs/:id/dashboard" element={<ClubOrganizerDashboard user={user} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClubOrganizerDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders valid member role and position controls for admins', async () => {
    const user = userEvent.setup();
    mockDashboardRequests({
      role: 'admin',
      members: [
        {
          id: 'member-1',
          email: 'member@purdue.edu',
          displayName: 'Member User',
          role: 'member',
          position: 'Member',
        },
      ],
      positions: ['Member', 'Treasurer', 'Event Lead'],
    });
    axios.patch.mockResolvedValue({ data: { success: true, member: { id: 'member-1' } } });

    renderDashboard({ id: 'owner-1', _id: 'owner-1' });

    await screen.findByText('Member User');

    const permissionsSelect = screen.getByLabelText('Permissions');
    const positionSelect = screen.getByLabelText('Position');

    expect(within(positionSelect).getByRole('option', { name: 'Treasurer' })).toBeInTheDocument();
    expect(within(positionSelect).getByRole('option', { name: 'Event Lead' })).toBeInTheDocument();

    await user.selectOptions(permissionsSelect, 'officer');
    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith('/api/clubs/club-1/members/member-1/role', { role: 'officer' });
    });

    await user.selectOptions(positionSelect, 'Treasurer');
    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith('/api/clubs/club-1/members/member-1/role', { position: 'Treasurer' });
    });
  });

  it('lets admins add a custom club position', async () => {
    const user = userEvent.setup();
    mockDashboardRequests({
      role: 'admin',
      members: [],
      positions: ['Member'],
    });
    axios.post.mockResolvedValue({ data: { positions: ['Member', 'Secretary'] } });

    renderDashboard({ id: 'owner-1', _id: 'owner-1' });

    await screen.findByText('Custom Positions');

    await user.type(screen.getByPlaceholderText('New position (e.g., Treasurer)'), 'Secretary');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/clubs/club-1/positions', { name: 'Secretary' });
    });
    expect(await screen.findByText('Secretary')).toBeInTheDocument();
  });

  it('shows view only for the current officer so they cannot change their own role', async () => {
    mockDashboardRequests({
      role: 'officer',
      members: [
        {
          id: 'viewer-1',
          email: 'viewer@purdue.edu',
          displayName: 'Viewer User',
          role: 'officer',
          position: 'Member',
        },
        {
          id: 'member-2',
          email: 'member2@purdue.edu',
          displayName: 'Other Member',
          role: 'member',
          position: 'Member',
        },
      ],
      positions: ['Member', 'Event Lead'],
    });

    renderDashboard({ id: 'viewer-1', _id: 'viewer-1' });

    await screen.findByText('Viewer User');

    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Permissions')).toHaveLength(1);
    expect(screen.getAllByLabelText('Position')).toHaveLength(1);
  });
});