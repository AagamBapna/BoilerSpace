import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import ChatWindow from '../components/ChatWindow';

vi.mock('axios');

function createSocketMock() {
    const handlers = {};
    const current = {
        connected: false,
        on: vi.fn((event, handler) => {
            handlers[event] = handler;
        }),
        off: vi.fn((event) => {
            delete handlers[event];
        }),
        emit: vi.fn(),
    };

    return { socket: { current }, handlers };
}

const baseConversation = {
    _id: 'conv-1',
    participants: [
        { _id: 'user-1', displayName: 'Me' },
        { _id: 'user-2', displayName: 'Other User' },
    ],
};

describe('ChatWindow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        axios.put.mockResolvedValue({ data: { message: 'Messages marked as read' } });
    });

    it('shows delete action only for current user messages', async () => {
        const { socket } = createSocketMock();
        axios.get.mockResolvedValueOnce({
            data: {
                messages: [
                    {
                        _id: 'm1',
                        text: 'mine',
                        sender: { _id: 'user-1' },
                        createdAt: new Date().toISOString(),
                    },
                    {
                        _id: 'm2',
                        text: 'theirs',
                        sender: { _id: 'user-2' },
                        createdAt: new Date().toISOString(),
                    },
                ],
                totalPages: 1,
                total: 2,
            },
        });

        render(
            <ChatWindow
                conversation={baseConversation}
                currentUserId="user-1"
                socket={socket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
            />
        );

        await waitFor(() => expect(screen.getByText('mine')).toBeInTheDocument());
        expect(screen.getAllByTitle('Delete message')).toHaveLength(1);
    });

    it('renders deleted message placeholder', async () => {
        const { socket } = createSocketMock();
        axios.get.mockResolvedValueOnce({
            data: {
                messages: [
                    {
                        _id: 'm1',
                        text: 'This message was deleted',
                        isDeleted: true,
                        sender: { _id: 'user-2' },
                        createdAt: new Date().toISOString(),
                    },
                ],
                totalPages: 1,
                total: 1,
            },
        });

        render(
            <ChatWindow
                conversation={baseConversation}
                currentUserId="user-1"
                socket={socket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
            />
        );

        await waitFor(() => expect(screen.getByText('This message was deleted')).toBeInTheDocument());
        expect(screen.queryByTitle('Delete message')).not.toBeInTheDocument();
    });

    it('sends disappearing payload when timer is enabled', async () => {
        const { socket } = createSocketMock();
        axios.get.mockResolvedValueOnce({
            data: {
                messages: [],
                totalPages: 1,
                total: 0,
            },
        });
        axios.post.mockResolvedValueOnce({
            data: {
                _id: 'm-new',
                text: 'sensitive',
                sender: { _id: 'user-1' },
                createdAt: new Date().toISOString(),
            },
        });

        render(
            <ChatWindow
                conversation={baseConversation}
                currentUserId="user-1"
                socket={socket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
            />
        );

        await waitFor(() => expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument());
        fireEvent.click(screen.getByLabelText('Disappearing message'));
        fireEvent.change(screen.getByDisplayValue('5 min'), { target: { value: '60' } });
        fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: 'sensitive' } });
        fireEvent.submit(screen.getByPlaceholderText('Type a message...').closest('form'));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledWith('/api/conversations/conv-1/messages', {
                text: 'sensitive',
                isDisappearing: true,
                disappearingDurationSeconds: 60,
            });
        });
    });

    it('removes a message when messageDisappeared socket event arrives', async () => {
        const { socket, handlers } = createSocketMock();
        axios.get.mockResolvedValueOnce({
            data: {
                messages: [
                    {
                        _id: 'm1',
                        text: 'will vanish',
                        sender: { _id: 'user-2' },
                        createdAt: new Date().toISOString(),
                    },
                ],
                totalPages: 1,
                total: 1,
            },
        });

        render(
            <ChatWindow
                conversation={baseConversation}
                currentUserId="user-1"
                socket={socket}
                onBack={vi.fn()}
                onMessagesRead={vi.fn()}
            />
        );

        await waitFor(() => expect(screen.getByText('will vanish')).toBeInTheDocument());
        act(() => {
            handlers.messageDisappeared({ conversationId: 'conv-1', messageId: 'm1' });
        });
        await waitFor(() => expect(screen.queryByText('will vanish')).not.toBeInTheDocument());
    });
});
