import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import EventPage from '../pages/EventPage';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('EventPage announcements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('boilerspace_token', 'fake-token');
  });

  test('shows event announcements in chronological order with timestamps', async () => {
    axios.get
      .mockResolvedValueOnce({
        data: {
          id: 'event-1',
          title: 'Hack Night',
          clubId: 'club-1',
          club: { name: 'CS Club', organizerIds: ['user-1'] },
        },
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'a2', message: 'Second update', createdAt: '2026-03-06T12:00:00.000Z', author: { displayName: 'Org 1' } },
          { id: 'a1', message: 'First update', createdAt: '2026-03-06T10:00:00.000Z', author: { displayName: 'Org 1' } },
        ],
      });

    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventPage user={{ id: 'user-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    const cards = await screen.findAllByRole('article');
    expect(within(cards[0]).getByText('First update')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Second update')).toBeInTheDocument();
  });

  test('shows required error when announcement content is missing', async () => {
    const user = userEvent.setup();

    axios.get
      .mockResolvedValueOnce({
        data: { id: 'event-1', title: 'Hack Night', clubId: 'club-1', club: { name: 'CS Club', organizerIds: ['user-1'] } },
      })
      .mockResolvedValueOnce({ data: [] });

    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventPage user={{ id: 'user-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('button', { name: 'Create Announcement' });
    await user.click(screen.getByRole('button', { name: 'Create Announcement' }));
    await screen.findByPlaceholderText('Announcement message');
    await user.click(screen.getByRole('button', { name: 'Post Announcement' }));

    expect(screen.getByText('Announcement message is required.')).toBeInTheDocument();
  });

  test('shows no-permission message when non-organizer attempts to post', async () => {
    const user = userEvent.setup();

    axios.get
      .mockResolvedValueOnce({
        data: { id: 'event-1', title: 'Hack Night', clubId: 'club-1', club: { name: 'CS Club', organizerIds: ['organizer-1'] } },
      })
      .mockResolvedValueOnce({ data: [] });

    render(
      <MemoryRouter initialEntries={['/events/event-1']}>
        <Routes>
          <Route path="/events/:id" element={<EventPage user={{ id: 'student-1' }} />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByRole('button', { name: 'Create Announcement' });
    await user.click(screen.getByRole('button', { name: 'Create Announcement' }));

    await waitFor(() => {
      expect(screen.getByText('You do not have permission to post announcements for this event.')).toBeInTheDocument();
    });
  });
});
