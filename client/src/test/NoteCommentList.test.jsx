import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import NoteCommentList from '../components/NoteCommentList';

vi.mock('axios');

const mockComments = [
    {
        _id: 'c1',
        noteId: 'note1',
        userId: { _id: 'user1', displayName: 'Alice', profilePictureUrl: '' },
        content: 'Great notes!',
        createdAt: new Date().toISOString(),
    },
    {
        _id: 'c2',
        noteId: 'note1',
        userId: { _id: 'user2', displayName: 'Bob', profilePictureUrl: 'https://example.com/bob.jpg' },
        content: 'Thanks for sharing.',
        createdAt: new Date().toISOString(),
    },
];

// ── NoteCommentList ───────────────────────────────────────────

describe('NoteCommentList', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders loading spinner initially', () => {
        axios.get.mockReturnValue(new Promise(() => {}));
        const { container } = render(<NoteCommentList noteId="note1" userId="user1" />);
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
        expect(screen.getByText('Loading comments...')).toBeInTheDocument();
    });

    it('displays comments after loading', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: mockComments, total: 2, page: 1 } });
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeInTheDocument();
            expect(screen.getByText('Great notes!')).toBeInTheDocument();
            expect(screen.getByText('Bob')).toBeInTheDocument();
            expect(screen.getByText('Thanks for sharing.')).toBeInTheDocument();
        });
    });

    it('shows comment count in header', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: mockComments, total: 2, page: 1 } });
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => {
            expect(screen.getByText('Comments (2)')).toBeInTheDocument();
        });
    });

    it('shows empty state when no comments', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: [], total: 0, page: 1 } });
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => {
            expect(screen.getByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
        });
    });

    it('shows error message on fetch failure', async () => {
        axios.get.mockRejectedValueOnce(new Error('Network error'));
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => {
            expect(screen.getByText('Failed to load comments.')).toBeInTheDocument();
        });
    });

    it('displays profile picture when available', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: mockComments, total: 2, page: 1 } });
        const { container } = render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => {
            const img = container.querySelector('img[src="https://example.com/bob.jpg"]');
            expect(img).toBeInTheDocument();
        });
    });

    it('displays initial avatar fallback when no profile picture', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: [mockComments[0]], total: 1, page: 1 } });
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => {
            expect(screen.getByText('A')).toBeInTheDocument();
        });
    });

    it('fetches comments with correct noteId', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: [], total: 0, page: 1 } });
        render(<NoteCommentList noteId="note123" userId="user1" />);

        await waitFor(() => {
            expect(axios.get).toHaveBeenCalledWith('/api/notes/note123/comments');
        });
    });
});

// ── Posting Comments ──────────────────────────────────────────

describe('NoteCommentList – posting', () => {
    beforeEach(() => vi.clearAllMocks());

    it('submits a new comment', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: [], total: 0, page: 1 } });
        const newComment = {
            _id: 'c3',
            noteId: 'note1',
            userId: { _id: 'user1', displayName: 'Alice', profilePictureUrl: '' },
            content: 'New comment',
            createdAt: new Date().toISOString(),
        };
        axios.post.mockResolvedValueOnce({ data: newComment });

        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => screen.getByPlaceholderText('Add a comment...'));

        const input = screen.getByPlaceholderText('Add a comment...');
        fireEvent.change(input, { target: { value: 'New comment' } });
        fireEvent.submit(input.closest('form'));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/notes/note1/comments', { content: 'New comment' });
            expect(screen.getByText('New comment')).toBeInTheDocument();
        });
    });

    it('clears input after successful post', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: [], total: 0, page: 1 } });
        axios.post.mockResolvedValueOnce({
            data: {
                _id: 'c3',
                noteId: 'note1',
                userId: { _id: 'user1', displayName: 'Alice', profilePictureUrl: '' },
                content: 'Test',
                createdAt: new Date().toISOString(),
            },
        });

        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => screen.getByPlaceholderText('Add a comment...'));

        const input = screen.getByPlaceholderText('Add a comment...');
        fireEvent.change(input, { target: { value: 'Test' } });
        fireEvent.submit(input.closest('form'));

        await waitFor(() => {
            expect(input.value).toBe('');
        });
    });

    it('does not submit empty comment', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: [], total: 0, page: 1 } });
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => screen.getByPlaceholderText('Add a comment...'));

        const input = screen.getByPlaceholderText('Add a comment...');
        fireEvent.submit(input.closest('form'));

        expect(axios.post).not.toHaveBeenCalled();
    });

    it('does not submit whitespace-only comment', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: [], total: 0, page: 1 } });
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => screen.getByPlaceholderText('Add a comment...'));

        const input = screen.getByPlaceholderText('Add a comment...');
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.submit(input.closest('form'));

        expect(axios.post).not.toHaveBeenCalled();
    });

    it('disables Post button when input is empty', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: [], total: 0, page: 1 } });
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => screen.getByText('Post'));

        expect(screen.getByText('Post')).toBeDisabled();
    });
});

// ── Deleting Comments ─────────────────────────────────────────

describe('NoteCommentList – deleting', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows delete button only for own comments', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: mockComments, total: 2, page: 1 } });
        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeInTheDocument();
        });

        // Only Alice's comment (user1) should have a delete button
        const deleteButtons = screen.getAllByTitle('Delete comment');
        expect(deleteButtons).toHaveLength(1);
    });

    it('does not show delete buttons when userId is not provided', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: mockComments, total: 2, page: 1 } });
        render(<NoteCommentList noteId="note1" />);

        await waitFor(() => {
            expect(screen.getByText('Alice')).toBeInTheDocument();
        });

        expect(screen.queryByTitle('Delete comment')).not.toBeInTheDocument();
    });

    it('calls delete endpoint and removes comment from list', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: mockComments, total: 2, page: 1 } });
        axios.delete.mockResolvedValueOnce({ data: { message: 'Comment deleted successfully.' } });
        window.confirm = vi.fn(() => true);

        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => screen.getByText('Alice'));

        fireEvent.click(screen.getByTitle('Delete comment'));

        await waitFor(() => {
            expect(axios.delete).toHaveBeenCalledWith('/api/notes/note1/comments/c1');
            expect(screen.queryByText('Great notes!')).not.toBeInTheDocument();
        });
    });

    it('does not delete when confirm is cancelled', async () => {
        axios.get.mockResolvedValueOnce({ data: { comments: mockComments, total: 2, page: 1 } });
        window.confirm = vi.fn(() => false);

        render(<NoteCommentList noteId="note1" userId="user1" />);

        await waitFor(() => screen.getByText('Alice'));

        fireEvent.click(screen.getByTitle('Delete comment'));

        expect(axios.delete).not.toHaveBeenCalled();
        expect(screen.getByText('Great notes!')).toBeInTheDocument();
    });
});
