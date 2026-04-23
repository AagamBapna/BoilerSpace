import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookmarkedResources from '../components/BookmarkedResources';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

import axios from 'axios';

const sampleBookmarks = [
  {
    _id: 'bm-1',
    promptString: 'What is a recurrence relation?',
    aiResponseText: 'A recurrence relation defines each term as a function of previous terms.',
    createdAt: '2026-04-01T12:00:00Z',
  },
  {
    _id: 'bm-2',
    promptString: 'Explain P vs NP',
    aiResponseText: 'P is the class of problems solvable in polynomial time; NP is nondeterministic polynomial.',
    createdAt: '2026-03-25T09:30:00Z',
  },
];

describe('BookmarkedResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders bookmarks fetched from the API', async () => {
    axios.get.mockResolvedValueOnce({ data: sampleBookmarks });

    render(<BookmarkedResources />);

    expect(await screen.findByText('What is a recurrence relation?')).toBeInTheDocument();
    expect(screen.getByText('Explain P vs NP')).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledWith('/api/users/bookmarks/ai');
  });

  test('shows the empty state when the API returns an empty array', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });

    render(<BookmarkedResources />);

    expect(
      await screen.findByText(/you haven't bookmarked any ai responses yet/i)
    ).toBeInTheDocument();
  });

  test('shows an error banner when the fetch fails', async () => {
    axios.get.mockRejectedValueOnce({
      response: { data: { error: 'Failed to load bookmarks' } },
    });

    render(<BookmarkedResources />);

    expect(await screen.findByText('Failed to load bookmarks')).toBeInTheDocument();
  });

  test('does not show the answer text until a card is expanded', async () => {
    axios.get.mockResolvedValueOnce({ data: sampleBookmarks });

    render(<BookmarkedResources />);

    await screen.findByText('What is a recurrence relation?');
    expect(
      screen.queryByText(/a recurrence relation defines each term/i)
    ).not.toBeInTheDocument();
  });

  test('clicking a card expands it to show the full question and full answer', async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValueOnce({ data: sampleBookmarks });

    render(<BookmarkedResources />);

    const prompt = await screen.findByText('What is a recurrence relation?');
    await user.click(prompt);

    expect(
      await screen.findByText(/a recurrence relation defines each term as a function of previous terms\./i)
    ).toBeInTheDocument();
    expect(screen.getByText('What is a recurrence relation?')).toBeInTheDocument();
  });

  test('removing a bookmark calls DELETE and removes it from the UI', async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValueOnce({ data: sampleBookmarks });
    axios.delete.mockResolvedValueOnce({ status: 204 });

    render(<BookmarkedResources />);

    await screen.findByText('What is a recurrence relation?');

    const removeButtons = screen.getAllByRole('button', { name: 'Remove bookmark' });
    await user.click(removeButtons[0]);

    await waitFor(() => {
      expect(axios.delete).toHaveBeenCalledWith('/api/users/bookmarks/ai/bm-1');
    });

    await waitFor(() => {
      expect(screen.queryByText('What is a recurrence relation?')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Explain P vs NP')).toBeInTheDocument();
  });

  test('shows an inline error if the delete request fails, and keeps the bookmark visible', async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValueOnce({ data: sampleBookmarks });
    axios.delete.mockRejectedValueOnce({
      response: { data: { error: 'Failed to remove bookmark' } },
    });

    render(<BookmarkedResources />);

    await screen.findByText('What is a recurrence relation?');

    const removeButtons = screen.getAllByRole('button', { name: 'Remove bookmark' });
    await user.click(removeButtons[0]);

    expect(await screen.findByText('Failed to remove bookmark')).toBeInTheDocument();
    expect(screen.getByText('What is a recurrence relation?')).toBeInTheDocument();
  });
});
