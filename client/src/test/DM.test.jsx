import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import DMInbox from '../components/DMInbox';

vi.mock('axios');

describe('DMInbox Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders DMInbox and shows loading state initially', () => {
        const mockSocket = { current: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } };
        axios.get.mockResolvedValueOnce({ data: [] });
        
        const { container } = render(
            <DMInbox currentUserId="user123" socket={mockSocket} onClose={vi.fn()} />
        );
        
        expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('displays "No conversations yet" when there are no conversations', async () => {
        const mockSocket = { current: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } };
        axios.get.mockResolvedValueOnce({ data: [] });
        
        render(<DMInbox currentUserId="user123" socket={mockSocket} onClose={vi.fn()} />);
        
        await waitFor(() => {
            expect(screen.getByText('No conversations yet')).toBeInTheDocument();
        });
    });

    it('loads and displays a conversation', async () => {
        const mockSocket = { current: { on: vi.fn(), off: vi.fn(), emit: vi.fn() } };
        const mockConversations = [
            {
                _id: 'conv1',
                participants: [{ _id: 'other456', displayName: 'Jane Doe' }],
                lastMessage: { text: 'Hello there!', timestamp: new Date().toISOString() },
                unreadCount: 0
            }
        ];
        
        axios.get.mockResolvedValueOnce({ data: mockConversations });
        
        render(<DMInbox currentUserId="user123" socket={mockSocket} onClose={vi.fn()} />);
        
        await waitFor(() => {
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
            expect(screen.getByText('Hello there!')).toBeInTheDocument();
        });
    });
});
