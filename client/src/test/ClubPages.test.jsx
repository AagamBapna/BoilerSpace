import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';
import CreateClub from '../pages/CreateClub';
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

describe('CreateClub page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('posts organizerIds from logged-in user and navigates with confirmation notice', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValueOnce({ data: { id: 'club-1' } });

    render(
      <MemoryRouter initialEntries={['/clubs/new']}>
        <Routes>
          <Route path="/clubs/new" element={<CreateClub user={{ id: 'user-1' }} />} />
          <Route path="/clubs/:id" element={<NoticeView />} />
        </Routes>
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('e.g. Purdue Robotics Club'), 'Robotics Club');
    await user.click(screen.getByRole('button', { name: 'Create Club' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/clubs', {
        name: 'Robotics Club',
        description: '',
        contactInfo: '',
        category: '',
        organizerIds: ['user-1'],
      });
    });

    expect(screen.getByText('Club created successfully.')).toBeInTheDocument();
  });
});

describe('ClubProfile page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows permission message when non-organizer tries to edit', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        id: 'club-1',
        name: 'CS Club',
        description: 'Tech org',
        category: 'Academic',
        contactInfo: 'cs@example.com',
        organizerIds: ['owner-1'],
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'other-user' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    await user.click(screen.getByRole('button', { name: 'Edit Club' }));

    expect(screen.getByText('You do not have permission to edit this club.')).toBeInTheDocument();
  });

  test('organizer can save profile updates and sends auth header', async () => {
    axios.get.mockResolvedValueOnce({
      data: {
        id: 'club-1',
        name: 'CS Club',
        description: 'Tech org',
        category: 'Academic',
        contactInfo: 'cs@example.com',
        organizerIds: ['owner-1'],
      },
    });

    axios.patch.mockResolvedValueOnce({
      data: {
        id: 'club-1',
        name: 'CS Club',
        description: 'Updated description',
        category: 'Academic',
        contactInfo: 'cs@example.com',
        organizerIds: ['owner-1'],
      },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/clubs/club-1']}>
        <Routes>
          <Route path="/clubs/:id" element={<ClubProfile user={{ id: 'owner-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('CS Club');
    await user.click(screen.getByRole('button', { name: 'Edit Club' }));

    const aboutLabel = screen.getByText('About');
    const aboutSection = aboutLabel.closest('div');
    const textarea = aboutSection.querySelector('textarea');
    await user.clear(textarea);
    await user.type(textarea, 'Updated description');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(axios.patch).toHaveBeenCalledWith(
        '/api/clubs/club-1',
        {
          name: 'CS Club',
          description: 'Updated description',
          contactInfo: 'cs@example.com',
          category: 'Academic',
        },
        {
          headers: { 'X-User-Id': 'owner-1' },
        }
      );
    });

    expect(screen.getByText('Club profile updated successfully.')).toBeInTheDocument();
  });
});
