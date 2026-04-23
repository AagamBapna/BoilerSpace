import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import GlobalEventBanner from '../components/GlobalEventBanner';

vi.mock('axios');

describe('GlobalEventBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('does not render if there is no active broadcast', async () => {
    axios.get.mockResolvedValueOnce({ data: null });
    const { container } = render(<GlobalEventBanner />);
    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('renders blue info style for info priority', async () => {
    axios.get.mockResolvedValueOnce({
      data: { id: '1', title: 'Info', body: 'Info body', priorityLevel: 'info' }
    });

    render(<GlobalEventBanner />);

    await waitFor(() => {
      expect(screen.getByText('Info')).toBeInTheDocument();
    });

    // Check if the container has the blue classes
    const container = screen.getByText('Info').closest('.rounded-2xl');
    expect(container).toHaveClass('bg-blue-500/20');
  });

  it('renders red alert style for alert priority', async () => {
    axios.get.mockResolvedValueOnce({
      data: { id: '2', title: 'Alert!', body: 'Red alert body', priorityLevel: 'alert' }
    });

    render(<GlobalEventBanner />);

    await waitFor(() => {
      expect(screen.getByText('Alert!')).toBeInTheDocument();
    });

    const container = screen.getByText('Alert!').closest('.rounded-2xl');
    expect(container).toHaveClass('bg-red-500/20');
  });

  it('hides the banner if it is dismissed and updates localStorage', async () => {
    axios.get.mockResolvedValueOnce({
      data: { id: '3', title: 'Dismiss me', body: 'Will disappear', priorityLevel: 'warning' }
    });

    render(<GlobalEventBanner />);

    await waitFor(() => {
      expect(screen.getByText('Dismiss me')).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /dismiss/i });
    closeBtn.click();

    await waitFor(() => {
      expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
    });

    const stored = JSON.parse(localStorage.getItem('dismissed_broadcasts'));
    expect(stored).toContain('3');
  });

  it('does not render banner if its id is already in localStorage', async () => {
    localStorage.setItem('dismissed_broadcasts', JSON.stringify(['4']));
    axios.get.mockResolvedValueOnce({
      data: { id: '4', title: 'Hidden', body: 'Hidden body', priorityLevel: 'info' }
    });

    const { container } = render(<GlobalEventBanner />);

    await waitFor(() => expect(axios.get).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });
});
