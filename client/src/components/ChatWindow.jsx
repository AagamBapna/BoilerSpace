import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function ChatWindow({ conversation, currentUserId, socket, onBack, onMessagesRead }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [isDisappearing, setIsDisappearing] = useState(false);
    const [disappearingDurationSeconds, setDisappearingDurationSeconds] = useState(300);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loadingMore, setLoadingMore] = useState(false);
    const bottomRef = useRef(null);
    const containerRef = useRef(null);
    const isInitialLoad = useRef(true);

    const otherUser = conversation.participants.find(p => p._id !== currentUserId);

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

        s.on('newMessage', handleNewMessage);
        s.on('messageSent', handleSent);
        s.on('messageDeleted', handleDeleted);
        s.on('messageDisappeared', handleDisappeared);

        return () => {
            s.off('newMessage', handleNewMessage);
            s.off('messageSent', handleSent);
            s.off('messageDeleted', handleDeleted);
            s.off('messageDisappeared', handleDisappeared);
        };
    }, [socket, conversation._id]);

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

    const handleSend = async (e) => {
        e.preventDefault();
        if (!text.trim() || sending) return;

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

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#CEB888]/10">
                <button onClick={onBack} className="p-1 hover:bg-[#ffffff08] rounded-lg transition-colors">
                    <svg className="w-5 h-5 text-[#a0a0a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                {otherUser?.profilePictureUrl ? (
                    <img src={otherUser.profilePictureUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-[#CEB888]/15 flex items-center justify-center text-sm font-bold text-[#CEB888]">
                        {otherUser?.displayName?.[0] || '?'}
                    </div>
                )}
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#f5f5f5] truncate">{otherUser?.displayName || 'User'}</p>
                </div>
            </div>

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
                        return (
                            <div key={msg._id}>
                                {showTime && (
                                    <p className="text-[10px] text-[#555] text-center my-2">{formatTime(msg.createdAt)}</p>
                                )}
                                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm break-words ${isDeleted
                                                ? 'bg-[#202020] text-[#8f8f8f] border border-[#ffffff10] italic'
                                                : isMine
                                                    ? 'bg-gradient-to-r from-[#CEB888] to-[#C28E0E] text-black rounded-br-md'
                                                    : 'bg-[#1e1e1e] text-[#f5f5f5] border border-[#ffffff08] rounded-bl-md'
                                            }`}
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
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

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
                        onChange={(e) => setText(e.target.value)}
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
