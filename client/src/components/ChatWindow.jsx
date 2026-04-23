import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { highlight } from '../utils/highlight.jsx';

export default function ChatWindow({ conversation, currentUserId, socket, onBack, onMessagesRead, onlineUserIds, initialJumpMessageId }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isDisappearing, setIsDisappearing] = useState(false);
    const [disappearingDurationSeconds, setDisappearingDurationSeconds] = useState(300);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isOtherTyping, setIsOtherTyping] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchRan, setSearchRan] = useState(false);
    const [jumpTargetId, setJumpTargetId] = useState(null);
    const bottomRef = useRef(null);
    const containerRef = useRef(null);
    const isInitialLoad = useRef(true);
    const typingTimeoutRef = useRef(null);
    const searchDebounceRef = useRef(null);
    const messagesRef = useRef([]);
    const pageRef = useRef(1);
    const totalPagesRef = useRef(1);
    const flashTimeoutRef = useRef(null);
    const initialJumpHandled = useRef(false);

    const otherUser = conversation.participants.find(p => p._id !== currentUserId);
    const isOtherOnline = onlineUserIds instanceof Set
        ? onlineUserIds.has(otherUser?._id)
        : false;

    useEffect(() => {
        loadMessages(1, true);
        markAsRead();
    }, [conversation._id]);

    useEffect(() => {
        const s = socket?.current;
        if (!s) return;

        const handleNewMessage = (data) => {
            if (data.conversationId === conversation._id) {
                setMessages(prev => [...prev, data.message]);
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
                markAsRead();
            }
        };

        const handleSent = (data) => {
            if (data.conversationId === conversation._id) {
                setMessages(prev => {
                    const exists = prev.some(m => m._id === data.message._id);
                    if (exists) return prev;
                    return [...prev, data.message];
                });
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
        };

        const handleDeleted = (data) => {
            if (data.conversationId === conversation._id) {
                setMessages(prev => prev.map((msg) => {
                    if (msg._id === data.message._id) {
                        return data.message;
                    }
                    return msg;
                }));
            }
        };

        const handleDisappeared = (data) => {
            if (data.conversationId === conversation._id) {
                setMessages(prev => prev.filter(msg => msg._id !== data.messageId));
            }
        };

        const handleMessagesRead = (data) => {
            if (data.conversationId === conversation._id) {
                setMessages(prev => prev.map(msg => {
                    const senderId = msg.sender?._id || msg.sender;
                    if (senderId === currentUserId && !msg.readAt) {
                        return { ...msg, readAt: data.readAt, readBy: [...(msg.readBy || []), data.readBy] };
                    }
                    return msg;
                }));
            }
        };

        const handleUserTyping = (data) => {
            if (data.conversationId === conversation._id) {
                setIsOtherTyping(true);
            }
        };

        const handleUserStopTyping = (data) => {
            if (data.conversationId === conversation._id) {
                setIsOtherTyping(false);
            }
        };

        s.on('newMessage', handleNewMessage);
        s.on('messageSent', handleSent);
        s.on('messageDeleted', handleDeleted);
        s.on('messageDisappeared', handleDisappeared);
        s.on('messagesRead', handleMessagesRead);
        s.on('userTyping', handleUserTyping);
        s.on('userStopTyping', handleUserStopTyping);

        return () => {
            s.off('newMessage', handleNewMessage);
            s.off('messageSent', handleSent);
            s.off('messageDeleted', handleDeleted);
            s.off('messageDisappeared', handleDisappeared);
            s.off('messagesRead', handleMessagesRead);
            s.off('userTyping', handleUserTyping);
            s.off('userStopTyping', handleUserStopTyping);
        };
    }, [socket, conversation._id]);

    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }
            if (flashTimeoutRef.current) {
                clearTimeout(flashTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        pageRef.current = page;
    }, [page]);

    useEffect(() => {
        totalPagesRef.current = totalPages;
    }, [totalPages]);

    useEffect(() => {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        setSearchRan(false);
        initialJumpHandled.current = false;
    }, [conversation._id]);

    const loadMessages = async (p, initial = false) => {
        try {
            if (initial) setLoading(true);
            else setLoadingMore(true);

            const res = await axios.get(`/api/conversations/${conversation._id}/messages?page=${p}&limit=30`);
            if (initial) {
                setMessages(res.data.messages);
                isInitialLoad.current = true;
            } else {
                const prevHeight = containerRef.current?.scrollHeight || 0;
                setMessages(prev => [...res.data.messages, ...prev]);
                setTimeout(() => {
                    if (containerRef.current) {
                        containerRef.current.scrollTop = containerRef.current.scrollHeight - prevHeight;
                    }
                }, 20);
            }
            setPage(p);
            setTotalPages(res.data.totalPages);
        } catch {
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (isInitialLoad.current && messages.length > 0) {
            isInitialLoad.current = false;
            setTimeout(() => bottomRef.current?.scrollIntoView(), 50);
        }
    }, [messages]);

    const markAsRead = async () => {
        try {
            await axios.put(`/api/conversations/${conversation._id}/read`);
            if (socket?.current) {
                socket.current.emit('markRead', { conversationId: conversation._id });
            }
            onMessagesRead?.(conversation._id);
        } catch { }
    };

    const runSearch = async (q) => {
        const trimmed = q.trim();
        if (trimmed.length < 2) {
            setSearchResults([]);
            setSearchRan(false);
            setSearchLoading(false);
            return;
        }
        setSearchLoading(true);
        try {
            const res = await axios.get(
                `/api/conversations/${conversation._id}/search?q=${encodeURIComponent(trimmed)}&page=1`
            );
            setSearchResults(res.data.results || []);
        } catch {
            setSearchResults([]);
        }
        setSearchLoading(false);
        setSearchRan(true);
    };

    const handleSearchChange = (q) => {
        setSearchQuery(q);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => runSearch(q), 250);
    };

    const flashMessage = (messageId) => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setJumpTargetId(messageId);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setJumpTargetId(null), 1600);
    };

    const jumpToMessage = async (messageId) => {
        if (!messageId) return;
        if (messagesRef.current.some((m) => m._id === messageId)) {
            setTimeout(() => flashMessage(messageId), 60);
            return;
        }
        while (pageRef.current < totalPagesRef.current) {
            await loadMessages(pageRef.current + 1);
            if (messagesRef.current.some((m) => m._id === messageId)) {
                setTimeout(() => flashMessage(messageId), 60);
                return;
            }
        }
    };

    useEffect(() => {
        if (!initialJumpMessageId || loading || initialJumpHandled.current) return;
        initialJumpHandled.current = true;
        jumpToMessage(initialJumpMessageId);
    }, [initialJumpMessageId, loading]);

    const handleTyping = () => {
        if (socket?.current?.connected) {
            socket.current.emit('typing', { conversationId: conversation._id });
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.current.emit('stopTyping', { conversationId: conversation._id });
            }, 2000);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() || sending) return;

        clearTimeout(typingTimeoutRef.current);
        if (socket?.current?.connected) {
            socket.current.emit('stopTyping', { conversationId: conversation._id });
        }

        const trimmed = text.trim();
        setText('');
        setSending(true);
        const payload = {
            text: trimmed,
            isDisappearing,
            ...(isDisappearing ? { disappearingDurationSeconds } : {}),
        };

        try {
            if (socket?.current?.connected) {
                socket.current.emit('sendMessage', {
                    conversationId: conversation._id,
                    ...payload,
                });
            } else {
                const res = await axios.post(`/api/conversations/${conversation._id}/messages`, payload);
                setMessages(prev => [...prev, res.data]);
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
            }
        } catch { }
        setSending(false);
    };

    const handleDeleteMessage = async (messageId) => {
        try {
            const res = await axios.delete(`/api/conversations/${conversation._id}/messages/${messageId}`);
            setMessages(prev => prev.map((msg) => {
                if (msg._id === messageId) {
                    return res.data;
                }
                return msg;
            }));
        } catch { }
    };

    const handleScroll = () => {
        if (containerRef.current?.scrollTop === 0 && page < totalPages && !loadingMore) {
            loadMessages(page + 1);
        }
    };

    const formatTime = (ts) => {
        const d = new Date(ts);
        const now = new Date();
        const diffDays = Math.floor((now - d) / 86400000);
        if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 1) return 'Yesterday';
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    const getLastOwnMessageIndex = () => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const senderId = messages[i].sender?._id || messages[i].sender;
            if (senderId === currentUserId && !messages[i].isDeleted) {
                return i;
            }
        }
        return -1;
    };

    const lastOwnMsgIdx = getLastOwnMessageIndex();

    const isMessageRead = (msg) => {
        if (msg.readAt) return true;
        if (msg.readBy && otherUser) {
            return msg.readBy.some(id => {
                const readId = typeof id === 'object' ? id.toString() : id;
                return readId === otherUser._id;
            });
        }
        return false;
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#CEB888]/10">
                <button onClick={onBack} className="p-1 hover:bg-[#ffffff08] rounded-lg transition-colors">
                    <svg className="w-5 h-5 text-[#a0a0a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="relative">
                    {otherUser?.profilePictureUrl ? (
                        <img src={otherUser.profilePictureUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-[#CEB888]/15 flex items-center justify-center text-sm font-bold text-[#CEB888]">
                            {otherUser?.displayName?.[0] || '?'}
                        </div>
                    )}
                    <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#141414] ${isOtherOnline ? 'bg-[#22c55e]' : 'bg-[#555]'}`}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#f5f5f5] truncate">{otherUser?.displayName || 'User'}</p>
                    <p className="text-[10px] text-[#777]">{isOtherOnline ? 'Online' : 'Offline'}</p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setSearchOpen((open) => {
                            const next = !open;
                            if (!next) {
                                setSearchQuery('');
                                setSearchResults([]);
                                setSearchRan(false);
                            }
                            return next;
                        });
                    }}
                    aria-label="Search messages"
                    title="Search messages"
                    className={`p-1.5 rounded-lg transition-colors ${searchOpen ? 'bg-[#CEB888]/15 text-[#CEB888]' : 'text-[#a0a0a0] hover:bg-[#ffffff08]'}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </button>
            </div>

            {searchOpen && (
                <div className="px-4 py-2 border-b border-[#CEB888]/10 flex flex-col gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search in this conversation..."
                        autoFocus
                        className="w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors"
                    />
                    {searchLoading && (
                        <p className="text-xs text-[#555] px-1">Searching...</p>
                    )}
                    {!searchLoading && searchRan && searchResults.length === 0 && (
                        <p className="text-xs text-[#555] px-1">No messages found for "{searchQuery.trim()}"</p>
                    )}
                    {searchResults.length > 0 && (
                        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                            {searchResults.map(({ match, above, below }) => {
                                const senderName = match.sender?.displayName || 'User';
                                return (
                                    <div
                                        key={match._id}
                                        className="rounded-lg border border-[#ffffff10] bg-[#111111] p-2 flex flex-col gap-1"
                                    >
                                        {above && (
                                            <p className="text-[11px] text-[#666] truncate">
                                                <span className="text-[#888]">{above.sender?.displayName || 'User'}:</span> {above.text}
                                            </p>
                                        )}
                                        <p className="text-xs text-[#f5f5f5]">
                                            <span className="text-[#CEB888] font-semibold">{senderName}:</span>{' '}
                                            {highlight(match.text, searchQuery)}
                                        </p>
                                        {below && (
                                            <p className="text-[11px] text-[#666] truncate">
                                                <span className="text-[#888]">{below.sender?.displayName || 'User'}:</span> {below.text}
                                            </p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => jumpToMessage(match._id)}
                                            className="self-end text-[11px] text-[#CEB888] hover:underline"
                                        >
                                            Jump to message
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1"
                style={{ minHeight: 0 }}
            >
                {loadingMore && (
                    <div className="text-center py-2">
                        <div className="w-5 h-5 border-2 border-[#CEB888]/30 border-t-[#CEB888] rounded-full animate-spin mx-auto" />
                    </div>
                )}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-[#CEB888]/30 border-t-[#CEB888] rounded-full animate-spin" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-[#555]">No messages yet. Say hello!</p>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMine = msg.sender?._id === currentUserId || msg.sender === currentUserId;
                        const isDeleted = msg.isDeleted;
                        const showTime = i === 0 || (new Date(msg.createdAt) - new Date(messages[i - 1]?.createdAt)) > 300000;
                        const showReceipt = isMine && !isDeleted && i === lastOwnMsgIdx;
                        const isFlashing = jumpTargetId === msg._id;
                        return (
                            <div key={msg._id} id={`msg-${msg._id}`}>
                                {showTime && (
                                    <p className="text-[10px] text-[#555] text-center my-2">{formatTime(msg.createdAt)}</p>
                                )}
                                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words transition-all duration-500 ${isDeleted
                                                ? 'bg-[#202020] text-[#8f8f8f] border border-[#ffffff10] italic'
                                                : isMine
                                                    ? 'bg-gradient-to-r from-[#CEB888] to-[#C28E0E] text-black rounded-br-md'
                                                    : 'bg-[#1e1e1e] text-[#f5f5f5] border border-[#ffffff08] rounded-bl-md'
                                            } ${isFlashing ? 'ring-2 ring-[#CEB888] shadow-[0_0_18px_rgba(206,184,136,0.7)]' : ''}`}
                                    >
                                        {msg.text}
                                    </div>
                                    {isMine && !isDeleted && (
                                        <button
                                            type="button"
                                            aria-label="Delete message"
                                            title="Delete message"
                                            onClick={() => handleDeleteMessage(msg._id)}
                                            className="ml-2 self-end text-[10px] text-[#888] hover:text-[#f5f5f5] transition-colors"
                                        >
                                            Delete
                                        </button>
                                    )}
                                </div>
                                {showReceipt && (
                                    <p className="text-[10px] text-right mt-0.5 mr-1 text-[#777]">
                                        {isMessageRead(msg) ? 'Seen' : 'Delivered'}
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {isOtherTyping && (
                <div className="px-4 py-1">
                    <p className="text-xs text-[#CEB888] animate-pulse">
                        {otherUser?.displayName || 'User'} is typing...
                    </p>
                </div>
            )}

            <form onSubmit={handleSend} className="px-4 py-3 border-t border-[#CEB888]/10">
                <div className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-2 text-xs text-[#a0a0a0]">
                        <input
                            type="checkbox"
                            checked={isDisappearing}
                            onChange={(e) => setIsDisappearing(e.target.checked)}
                            className="accent-[#CEB888]"
                        />
                        Disappearing message
                    </label>
                    {isDisappearing && (
                        <select
                            value={disappearingDurationSeconds}
                            onChange={(e) => setDisappearingDurationSeconds(Number(e.target.value))}
                            className="bg-[#111111] border border-[#CEB888]/20 rounded-lg px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#CEB888]/50"
                        >
                            <option value={5}>5 sec</option>
                            <option value={30}>30 sec</option>
                            <option value={60}>1 min</option>
                            <option value={300}>5 min</option>
                            <option value={1800}>30 min</option>
                            <option value={3600}>1 hour</option>
                        </select>
                    )}
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            handleTyping();
                        }}
                        placeholder="Type a message..."
                        maxLength={2000}
                        className="flex-1 bg-[#111111] border border-[#CEB888]/20 rounded-full px-4 py-2.5 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!text.trim() || sending}
                        className="w-10 h-10 rounded-full bg-gradient-to-r from-[#CEB888] to-[#C28E0E] flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0"
                    >
                        <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                        </svg>
                    </button>
                </div>
            </form>
        </div>
    );
}
