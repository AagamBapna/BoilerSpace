import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import DMInbox from '../components/DMInbox';
import ChatWindow from '../components/ChatWindow';

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

    it('shows green presence dot for online users', async () => {
        const mockSocket = {
            current: {
                on: vi.fn(),
                off: vi.fn(),
                emit: vi.fn(),
            }
        };
        const mockConversations = [
            {
                _id: 'conv1',
                participants: [{ _id: 'user123', displayName: 'Me' }, { _id: 'other456', displayName: 'Jane Doe' }],
                lastMessage: { text: 'Hello', timestamp: new Date().toISOString() },
                unreadCount: 0,
                updatedAt: new Date().toISOString(),
            }
        ];

        axios.get.mockResolvedValueOnce({ data: mockConversations });

        const { container } = render(
            <DMInbox
                currentUserId="user123"
                socket={mockSocket}
                onClose={vi.fn()}
                onlineUserIds={new Set(['other456'])}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        });

        const greenDot = container.querySelector('.bg-\\[\\#22c55e\\]');
        expect(greenDot).toBeInTheDocument();
    });

    it('shows grey presence dot for offline users', async () => {
        const mockSocket = {
            current: {
                on: vi.fn(),
                off: vi.fn(),
                emit: vi.fn(),
            }
        };
        const mockConversations = [
            {
                _id: 'conv1',
                participants: [{ _id: 'user123', displayName: 'Me' }, { _id: 'other456', displayName: 'Jane Doe' }],
                lastMessage: { text: 'Hello', timestamp: new Date().toISOString() },
                unreadCount: 0,
                updatedAt: new Date().toISOString(),
            }
        ];

        axios.get.mockResolvedValueOnce({ data: mockConversations });

        const { container } = render(<DMInbox currentUserId="user123" socket={mockSocket} onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        });

        const greyDot = container.querySelector('.bg-\\[\\#555\\]');
        expect(greyDot).toBeInTheDocument();
    });
});

describe('ChatWindow Component', () => {
    const mockConversation = {
        _id: 'conv1',
        participants: [
            { _id: 'user123', displayName: 'Me' },
            { _id: 'other456', displayName: 'Jane Doe' },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows typing indicator when userTyping event fires', async () => {
        const listeners = {};
        const mockSocket = {
            current: {
                on: vi.fn((event, cb) => { listeners[event] = cb; }),
                off: vi.fn(),
                emit: vi.fn(),
                connected: true,
            }
        };

        axios.get.mockResolvedValueOnce({
            data: { messages: [], page: 1, totalPages: 1, total: 0 },
        });
        axios.put.mockResolvedValueOnce({ data: { message: 'Messages marked as read' } });

        render(
            <ChatWindow
                conversation={mockConversation}
                currentUserId="user123"
                socket={mockSocket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
                onlineUserIds={new Set()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('No messages yet. Say hello!')).toBeInTheDocument();
        });

        act(() => {
            listeners.userTyping({ conversationId: 'conv1', userId: 'other456' });
        });

        await waitFor(() => {
            expect(screen.getByText('Jane Doe is typing...')).toBeInTheDocument();
        });
    });

    it('hides typing indicator when userStopTyping event fires', async () => {
        const listeners = {};
        const mockSocket = {
            current: {
                on: vi.fn((event, cb) => { listeners[event] = cb; }),
                off: vi.fn(),
                emit: vi.fn(),
                connected: true,
            }
        };

        axios.get.mockResolvedValueOnce({
            data: { messages: [], page: 1, totalPages: 1, total: 0 },
        });
        axios.put.mockResolvedValueOnce({ data: { message: 'Messages marked as read' } });

        render(
            <ChatWindow
                conversation={mockConversation}
                currentUserId="user123"
                socket={mockSocket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
                onlineUserIds={new Set()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('No messages yet. Say hello!')).toBeInTheDocument();
        });

        act(() => {
            listeners.userTyping({ conversationId: 'conv1', userId: 'other456' });
        });

        await waitFor(() => {
            expect(screen.getByText('Jane Doe is typing...')).toBeInTheDocument();
        });

        act(() => {
            listeners.userStopTyping({ conversationId: 'conv1', userId: 'other456' });
        });

        await waitFor(() => {
            expect(screen.queryByText('Jane Doe is typing...')).not.toBeInTheDocument();
        });
    });

    it('shows Delivered under last sent message before read', async () => {
        const mockSocket = {
            current: {
                on: vi.fn(),
                off: vi.fn(),
                emit: vi.fn(),
                connected: true,
            }
        };

        const mockMessages = [
            {
                _id: 'msg1',
                conversationId: 'conv1',
                sender: { _id: 'user123', displayName: 'Me' },
                text: 'Hello there',
                createdAt: new Date().toISOString(),
                readBy: ['user123'],
                readAt: null,
                isDeleted: false,
            },
        ];

        axios.get.mockResolvedValueOnce({
            data: { messages: mockMessages, page: 1, totalPages: 1, total: 1 },
        });
        axios.put.mockResolvedValueOnce({ data: { message: 'Messages marked as read' } });

        render(
            <ChatWindow
                conversation={mockConversation}
                currentUserId="user123"
                socket={mockSocket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
                onlineUserIds={new Set()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Delivered')).toBeInTheDocument();
        });
    });

    it('shows Seen under last sent message when messagesRead fires', async () => {
        const listeners = {};
        const mockSocket = {
            current: {
                on: vi.fn((event, cb) => { listeners[event] = cb; }),
                off: vi.fn(),
                emit: vi.fn(),
                connected: true,
            }
        };

        const mockMessages = [
            {
                _id: 'msg1',
                conversationId: 'conv1',
                sender: { _id: 'user123', displayName: 'Me' },
                text: 'Hello there',
                createdAt: new Date().toISOString(),
                readBy: ['user123'],
                readAt: null,
                isDeleted: false,
            },
        ];

        axios.get.mockResolvedValueOnce({
            data: { messages: mockMessages, page: 1, totalPages: 1, total: 1 },
        });
        axios.put.mockResolvedValueOnce({ data: { message: 'Messages marked as read' } });

        render(
            <ChatWindow
                conversation={mockConversation}
                currentUserId="user123"
                socket={mockSocket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
                onlineUserIds={new Set()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Delivered')).toBeInTheDocument();
        });

        act(() => {
            listeners.messagesRead({
                conversationId: 'conv1',
                readBy: 'other456',
                readAt: new Date().toISOString(),
            });
        });

        await waitFor(() => {
            expect(screen.getByText('Seen')).toBeInTheDocument();
        });
    });

    it('shows Online text when other user is online', async () => {
        const mockSocket = {
            current: {
                on: vi.fn(),
                off: vi.fn(),
                emit: vi.fn(),
                connected: true,
            }
        };

        axios.get.mockResolvedValueOnce({
            data: { messages: [], page: 1, totalPages: 1, total: 0 },
        });
        axios.put.mockResolvedValueOnce({ data: { message: 'Messages marked as read' } });

        render(
            <ChatWindow
                conversation={mockConversation}
                currentUserId="user123"
                socket={mockSocket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
                onlineUserIds={new Set(['other456'])}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Online')).toBeInTheDocument();
        });
    });

    it('shows Offline text when other user is not online', async () => {
        const mockSocket = {
            current: {
                on: vi.fn(),
                off: vi.fn(),
                emit: vi.fn(),
                connected: true,
            }
        };

        axios.get.mockResolvedValueOnce({
            data: { messages: [], page: 1, totalPages: 1, total: 0 },
        });
        axios.put.mockResolvedValueOnce({ data: { message: 'Messages marked as read' } });

        render(
            <ChatWindow
                conversation={mockConversation}
                currentUserId="user123"
                socket={mockSocket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
                onlineUserIds={new Set()}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Offline')).toBeInTheDocument();
        });
    });
});

describe('DMInbox Requests Tab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockSocket = {
        current: {
            on: vi.fn(),
            off: vi.fn(),
            emit: vi.fn(),
        }
    };

    it('shows Requests tab with badge count', async () => {
        axios.get.mockImplementation((url) => {
            if (url === '/api/conversations') return Promise.resolve({ data: [] });
            if (url === '/api/conversations/requests') return Promise.resolve({
                data: [
                    {
                        _id: 'req1',
                        participants: [{ _id: 'other456', displayName: 'Jane Doe' }],
                        messagePreview: { text: 'let me message you' }
                    }
                ]
            });
        });

        render(<DMInbox currentUserId="user123" socket={mockSocket} onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByText('Requests')).toBeInTheDocument();
            const badge = screen.getByText('1');
            expect(badge).toBeInTheDocument();
        });
    });

    it('accept button moves conversation to inbox', async () => {
        axios.get.mockImplementation((url) => {
            if (url === '/api/conversations') return Promise.resolve({ data: [] });
            if (url === '/api/conversations/requests') return Promise.resolve({
                data: [
                    {
                        _id: 'req1',
                        participants: [{ _id: 'other456', displayName: 'Jane Doe' }],
                        messagePreview: { text: 'let me message you' }
                    }
                ]
            });
        });

        axios.post.mockImplementation((url) => {
            if (url === '/api/conversations/req1/accept') {
                return Promise.resolve({
                    data: {
                        _id: 'req1',
                        participants: [{ _id: 'other456', displayName: 'Jane Doe' }],
                        lastMessage: { text: 'let me message you' },
                        updatedAt: new Date().toISOString()
                    }
                });
            }
        });

        render(<DMInbox currentUserId="user123" socket={mockSocket} onClose={vi.fn()} />);

        await waitFor(() => {
            fireEvent.click(screen.getByText(/Requests/i));
        });

        await waitFor(() => {
            expect(screen.getByText('Accept')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Accept'));

        await waitFor(() => {
            expect(screen.getByText('Jane Doe')).toBeInTheDocument();
            expect(screen.queryByText('Accept')).not.toBeInTheDocument();
        });
    });

    it('reject button removes conversation from requests', async () => {
        axios.get.mockImplementation((url) => {
            if (url === '/api/conversations') return Promise.resolve({ data: [] });
            if (url === '/api/conversations/requests') return Promise.resolve({
                data: [
                    {
                        _id: 'req1',
                        participants: [{ _id: 'other456', displayName: 'Jane Doe' }],
                        messagePreview: { text: 'let me message you' }
                    }
                ]
            });
        });

        axios.post.mockResolvedValueOnce({ data: { message: 'rejected' } });

        render(<DMInbox currentUserId="user123" socket={mockSocket} onClose={vi.fn()} />);

        await waitFor(() => {
            fireEvent.click(screen.getByText(/Requests/i));
        });

        await waitFor(() => {
            expect(screen.getByText('Reject')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Reject'));

        await waitFor(() => {
            expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
            expect(screen.getByText('No message requests')).toBeInTheDocument();
        });
    });

    it('requests tab shows message preview', async () => {
        axios.get.mockImplementation((url) => {
            if (url === '/api/conversations') return Promise.resolve({ data: [] });
            if (url === '/api/conversations/requests') return Promise.resolve({
                data: [
                    {
                        _id: 'req1',
                        participants: [{ _id: 'other456', displayName: 'Jane Doe' }],
                        messagePreview: { text: 'A preview of the message' }
                    }
                ]
            });
        });

        render(<DMInbox currentUserId="user123" socket={mockSocket} onClose={vi.fn()} />);

        await waitFor(() => {
            fireEvent.click(screen.getByText(/Requests/i));
        });

        await waitFor(() => {
            expect(screen.getByText('A preview of the message')).toBeInTheDocument();
        });
    });
});
