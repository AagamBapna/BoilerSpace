import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import ClassmateSearch from '../components/ClassmateSearch';

// We will use vi.spyOn

describe('ClassmateSearch Component', () => {
  const mockOnClose = vi.fn();
  const mockOnViewProfile = vi.fn();

  let axiosGetSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    axiosGetSpy = vi.spyOn(axios, 'get');
  });

  const mockUsers = [
    {
      _id: 'user1',
      displayName: 'Alice Test',
      major: 'Computer Science',
      year: 'Senior',
      profilePictureUrl: '',
      matchScore: 8,
      matchHighlights: ['Study style match: solo', 'Shared interests: coding']
    },
    {
      _id: 'user2',
      displayName: 'Bob Test',
      major: 'Mathematics',
      year: 'Junior',
      profilePictureUrl: '',
      matchScore: 3,
      matchHighlights: ['Environment match: quiet']
    }
  ];

  it('renders search form elements correctly', async () => {
    // Return empty array for the initial passive search
    axiosGetSpy.mockResolvedValueOnce({ data: [] });

    render(<ClassmateSearch onClose={mockOnClose} onViewProfile={mockOnViewProfile} />);

    await waitFor(() => expect(axiosGetSpy).toHaveBeenCalledWith('/api/users/discovery', { params: {} }));

    expect(screen.getByText('Find Classmates')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search by name...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. math, hiking')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. pass exams')).toBeInTheDocument();

    // Check initial "No results found"
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });

  it('submits search criteria correctly and displays results', async () => {
    // Initial fetch
    axiosGetSpy.mockResolvedValueOnce({ data: [] });
    // Search fetch
    axiosGetSpy.mockResolvedValueOnce({ data: mockUsers });

    render(<ClassmateSearch onClose={mockOnClose} onViewProfile={mockOnViewProfile} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Search Classmates' })).toBeInTheDocument()
    );

    // Fill out the search form
    fireEvent.change(screen.getByPlaceholderText('Search by name...'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. math, hiking'), { target: { value: 'coding' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Search Classmates' }));

    // Verify axios parameters
    await waitFor(() => {
      expect(axiosGetSpy).toHaveBeenCalledWith('/api/users/discovery', {
        params: { q: 'Test', interests: 'coding' }
      });
    });

    // Check rendering of results and match highlights
    expect(screen.getByText('Alice Test')).toBeInTheDocument();
    expect(screen.getByText('Bob Test')).toBeInTheDocument();
    expect(screen.getByText('Computer Science · Senior')).toBeInTheDocument();
    expect(screen.getByText('Study style match: solo')).toBeInTheDocument();
    expect(screen.getByText('Shared interests: coding')).toBeInTheDocument();
  });

  it('handles clicking a classmate result to open profile', async () => {
    axiosGetSpy.mockResolvedValueOnce({ data: mockUsers });

    render(<ClassmateSearch onClose={mockOnClose} onViewProfile={mockOnViewProfile} />);

    await waitFor(() => expect(screen.getByText('Alice Test')).toBeInTheDocument());

    const user1Card = screen.getByText('Alice Test').closest('.cursor-pointer');
    fireEvent.click(user1Card);

    expect(mockOnViewProfile).toHaveBeenCalledWith('user1');
  });

  it('handles and displays errors correctly', async () => {
    // Initial request fails
    axiosGetSpy.mockRejectedValueOnce({ response: { data: { error: 'Test error' } } });

    render(<ClassmateSearch onClose={mockOnClose} onViewProfile={mockOnViewProfile} />);

    await waitFor(() => expect(screen.getByText('Test error')).toBeInTheDocument());
  });
});
