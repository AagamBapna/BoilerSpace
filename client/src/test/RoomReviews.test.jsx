import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import RoomReviews from '../components/RoomReviews';

// Mock axios
vi.mock('axios');

const mockUser = { _id: 'u1', displayName: 'Test User' };
const roomId = 'r1';

describe('RoomReviews Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('submits a review and displays it at the top', async () => {
        const user = userEvent.setup();
        
        // Initial state with one existing review
        const initialReviews = [
            { 
                _id: 'rev1', 
                rating: 4, 
                comment: 'Older review', 
                createdAt: '2023-01-01T00:00:00Z', 
                userId: { _id: 'u2', displayName: 'User 1' } 
            }
        ];
        
        axios.get.mockResolvedValueOnce({ 
            data: { reviews: initialReviews, averageRating: 4, totalReviews: 1 } 
        });

        const { container } = render(<RoomReviews roomId={roomId} user={mockUser} />);

        // Wait for component to load and show initial review
        await waitFor(() => {
            expect(screen.getByText('Older review')).toBeInTheDocument();
        });

        // 1. Select a star rating (5 stars)
        const formStars = container.querySelectorAll('form svg');
        fireEvent.click(formStars[4]);

        // 2. Enter a comment
        const textarea = screen.getByPlaceholderText(/What's this spot like/i);
        await user.type(textarea, 'This is the newest review!');

        // 3. Mock the POST request and the subsequent re-fetch
        axios.post.mockResolvedValueOnce({ data: {} });
        
        const updatedReviews = [
            { 
                _id: 'rev2', 
                rating: 5, 
                comment: 'This is the newest review!', 
                createdAt: new Date().toISOString(), 
                userId: mockUser 
            },
            ...initialReviews
        ];
        
        axios.get.mockResolvedValueOnce({ 
            data: { reviews: updatedReviews, averageRating: 4.5, totalReviews: 2 } 
        });

        // 4. Click the post button
        const postButton = screen.getByText('Post Review');
        await user.click(postButton);

        // 5. Verify the new review appears at the top
        await waitFor(() => {
            expect(screen.getByText('This is the newest review!')).toBeInTheDocument();
        });

        const allComments = container.querySelectorAll('p.word-break');
        expect(allComments[0]).toHaveTextContent('This is the newest review!');
        expect(allComments[1]).toHaveTextContent('Older review');
        
        // Verify average rating display
        expect(screen.getByText('4.5 / 5')).toBeInTheDocument();
        
        // Verify form was cleared
        expect(textarea.value).toBe('');
    });

    it('shows an error if rating is not selected', async () => {
        const user = userEvent.setup();
        axios.get.mockResolvedValueOnce({ data: { reviews: [], averageRating: 0, totalReviews: 0 } });

        render(<RoomReviews roomId={roomId} user={mockUser} />);

        const textarea = await screen.findByPlaceholderText(/What's this spot like/i);
        await user.type(textarea, 'Forgot the stars!');

        const postButton = screen.getByText('Post Review');
        await user.click(postButton);

        expect(screen.getByText('Please select a star rating.')).toBeInTheDocument();
        expect(axios.post).not.toHaveBeenCalled();
    });
});
