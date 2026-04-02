import { useState, useEffect } from 'react';
import axios from 'axios';
import ChatWindow from './ChatWindow';

export default function DMInbox({ currentUserId, socket, onClose }) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeConversation, setActiveConversation] = useState(null);
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        loadConversations();
    }, []);

    useEffect(() => {
        const s = socket?.current;
        if (!s) return;

        const handleNewMessage = (data) => {
            setConversations(prev => {
                const updated = prev.map(c => {
                    if (c._id === data.conversationId) {
                        return {
                            ...c,
                            lastMessage: {
                                text: data.message.text,
                                sender: data.message.sender._id || data.message.sender,
                                timestamp: data.message.createdAt,
                            },
                            unreadCount: activeConversation?._id === data.conversationId
                                ? c.unreadCount
                                : (c.unreadCount || 0) + 1,
                            updatedAt: data.message.createdAt,
                        };
                    }
                    return c;
                });
                return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            });
        };

        const handleSent = (data) => {
            setConversations(prev => {
                const updated = prev.map(c => {
                    if (c._id === data.conversationId) {
                        return {
                            ...c,
                            lastMessage: {
                                text: data.message.text,
                                sender: data.message.sender._id || data.message.sender,
                                timestamp: data.message.createdAt,
                            },
                            updatedAt: data.message.createdAt,
                        };
                    }
                    return c;
                });
                return updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
            });
        };

        const handleDeleted = () => {
            loadConversations();
        };

        const handleDisappeared = () => {
            loadConversations();
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
    }, [socket, activeConversation]);

    const loadConversations = async () => {
        try {
            const res = await axios.get('/api/conversations');
            setConversations(res.data);
        } catch { }
        setLoading(false);
    };

    const handleStartConversation = async (userId) => {
        try {
            const res = await axios.post('/api/conversations', { participantId: userId });
            setSearchMode(false);
            setSearchQuery('');
            setSearchResults([]);
            setActiveConversation(res.data);
            await loadConversations();
        } catch { }
    };

    const handleSearch = async (q) => {
        setSearchQuery(q);
        if (q.trim().length < 2) {
            setSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await axios.get(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
            setSearchResults(res.data.filter(u => u._id !== currentUserId));
        } catch {
            setSearchResults([]);
        }
        setSearching(false);
    };

    const handleMessagesRead = (convId) => {
        setConversations(prev =>
            prev.map(c => c._id === convId ? { ...c, unreadCount: 0 } : c)
        );
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        const now = new Date();
        const diffDays = Math.floor((now - d) / 86400000);
        if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    };

    if (activeConversation) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div
                    className="w-full max-w-md mx-4 rounded-2xl flex flex-col"
                    style={{ background: '#141414', border: '1px solid rgba(206,184,136,0.15)', height: 'min(600px, 85vh)' }}
                >
                    <ChatWindow
                        conversation={activeConversation}
                        currentUserId={currentUserId}
                        socket={socket}
                        onBack={() => {
                            setActiveConversation(null);
                            loadConversations();
                        }}
                        onMessagesRead={handleMessagesRead}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div
                className="w-full max-w-md mx-4 rounded-2xl flex flex-col"
                style={{ background: '#141414', border: '1px solid rgba(206,184,136,0.15)', height: 'min(600px, 85vh)' }}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#CEB888]/10">
                    <h2 className="text-lg font-bold text-[#f5f5f5]">Messages</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSearchMode(!searchMode)}
                            className="p-2 hover:bg-[#ffffff08] rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-[#CEB888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[#ffffff08] rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-[#a0a0a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {searchMode && (
                    <div className="px-4 py-2 border-b border-[#CEB888]/10">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search users by name..."
                            autoFocus
                            className="w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors"
                        />
                        {searching && (
                            <p className="text-xs text-[#555] mt-2 px-1">Searching...</p>
                        )}
                        {searchResults.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                                {searchResults.map(user => (
                                    <button
                                        key={user._id}
                                        onClick={() => handleStartConversation(user._id)}
                                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#ffffff08] transition-colors text-left"
                                    >
                                        {user.profilePictureUrl ? (
                                            <img src={user.profilePictureUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-[#CEB888]/15 flex items-center justify-center text-xs font-bold text-[#CEB888]">
                                                {user.displayName?.[0] || '?'}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-[#f5f5f5] truncate">{user.displayName}</p>
                                            <p className="text-xs text-[#555] truncate">{user.email}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                            <p className="text-xs text-[#555] mt-2 px-1">No users found</p>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-[#CEB888]/30 border-t-[#CEB888] rounded-full animate-spin" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-[#CEB888]/10 flex items-center justify-center">
                                <svg className="w-7 h-7 text-[#CEB888]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <p className="text-sm text-[#555]">No conversations yet</p>
                            <button
                                onClick={() => setSearchMode(true)}
                                className="text-xs text-[#CEB888] hover:underline"
                            >
                                Start a new conversation
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {conversations.map(conv => {
                                const other = conv.participants.find(p => p._id !== currentUserId);
                                return (
                                    <button
                                        key={conv._id}
                                        onClick={() => setActiveConversation(conv)}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-[#ffffff05] transition-colors text-left border-b border-[#ffffff06]"
                                    >
                                        {other?.profilePictureUrl ? (
                                            <img src={other.profilePictureUrl} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                                        ) : (
                                            <div className="w-11 h-11 rounded-full bg-[#CEB888]/15 flex items-center justify-center text-sm font-bold text-[#CEB888] flex-shrink-0">
                                                {other?.displayName?.[0] || '?'}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-[#f5f5f5] truncate">{other?.displayName || 'User'}</p>
                                                <span className="text-[10px] text-[#555] flex-shrink-0 ml-2">
                                                    {formatTime(conv.lastMessage?.timestamp || conv.updatedAt)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <p className="text-xs text-[#777] truncate">
                                                    {conv.lastMessage?.text || 'No messages yet'}
                                                </p>
                                                {conv.unreadCount > 0 && (
                                                    <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-[#CEB888] text-black text-[10px] font-bold flex items-center justify-center">
                                                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
