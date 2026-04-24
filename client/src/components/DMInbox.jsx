import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ChatWindow from './ChatWindow';
import { highlight } from '../utils/highlight.jsx';

export default function DMInbox({ currentUserId, socket, onClose, onlineUserIds = new Set() }) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeConversation, setActiveConversation] = useState(null);
    const [jumpMessageId, setJumpMessageId] = useState(null);
    const [searchMode, setSearchMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [activeTab, setActiveTab] = useState('inbox');
    const [requests, setRequests] = useState([]);
    const [loadingRequests, setLoadingRequests] = useState(false);
    const [msgQuery, setMsgQuery] = useState('');
    const [msgGroups, setMsgGroups] = useState([]);
    const [msgSearching, setMsgSearching] = useState(false);
    const [msgSearchRan, setMsgSearchRan] = useState(false);
    const msgDebounceRef = useRef(null);

    useEffect(() => {
        loadConversations();
        loadRequests();
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

        const handleConversationAccepted = () => {
            loadConversations();
            loadRequests();
        };

        s.on('newMessage', handleNewMessage);
        s.on('messageSent', handleSent);
        s.on('messageDeleted', handleDeleted);
        s.on('messageDisappeared', handleDisappeared);
        s.on('conversationAccepted', handleConversationAccepted);

        return () => {
            s.off('newMessage', handleNewMessage);
            s.off('messageSent', handleSent);
            s.off('messageDeleted', handleDeleted);
            s.off('messageDisappeared', handleDisappeared);
            s.off('conversationAccepted', handleConversationAccepted);
        };
    }, [socket, activeConversation]);

    const loadConversations = async () => {
        try {
            const res = await axios.get('/api/conversations');
            setConversations(res.data);
        } catch { }
        setLoading(false);
    };

    const loadRequests = async () => {
        setLoadingRequests(true);
        try {
            const res = await axios.get('/api/conversations/requests');
            setRequests(res.data);
        } catch { }
        setLoadingRequests(false);
    };

    const handleAcceptRequest = async (convId) => {
        try {
            const res = await axios.post(`/api/conversations/${convId}/accept`);
            setRequests(prev => prev.filter(r => r._id !== convId));
            setConversations(prev => [...prev, { ...res.data, unreadCount: 0 }].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
            setActiveTab('inbox');
        } catch { }
    };

    const handleRejectRequest = async (convId) => {
        try {
            await axios.post(`/api/conversations/${convId}/reject`);
            setRequests(prev => prev.filter(r => r._id !== convId));
        } catch { }
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

    const runMessageSearch = async (q) => {
        const trimmed = q.trim();
        if (trimmed.length < 2) {
            setMsgGroups([]);
            setMsgSearchRan(false);
            setMsgSearching(false);
            return;
        }
        setMsgSearching(true);
        try {
            const res = await axios.get(`/api/messages/search?q=${encodeURIComponent(trimmed)}&page=1`);
            setMsgGroups(res.data.groups || []);
        } catch {
            setMsgGroups([]);
        }
        setMsgSearching(false);
        setMsgSearchRan(true);
    };

    const handleMsgQueryChange = (q) => {
        setMsgQuery(q);
        if (msgDebounceRef.current) clearTimeout(msgDebounceRef.current);
        msgDebounceRef.current = setTimeout(() => runMessageSearch(q), 250);
    };

    useEffect(() => {
        return () => {
            if (msgDebounceRef.current) clearTimeout(msgDebounceRef.current);
        };
    }, []);

    const handleOpenResult = (group, messageId) => {
        const conv = conversations.find((c) => c._id === group.conversation._id);
        if (conv) {
            setJumpMessageId(messageId);
            setActiveConversation(conv);
            return;
        }
        setJumpMessageId(messageId);
        setActiveConversation({
            _id: group.conversation._id,
            participants: [
                group.conversation.otherUser,
                { _id: currentUserId },
            ].filter(Boolean),
        });
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
                            setJumpMessageId(null);
                            loadConversations();
                        }}
                        onMessagesRead={handleMessagesRead}
                        onlineUserIds={onlineUserIds}
                        initialJumpMessageId={jumpMessageId}
                    />
                </div>
            </div>
        );
    }

    const renderInbox = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-[#CEB888]/30 border-t-[#CEB888] rounded-full animate-spin" />
                </div>
            );
        }

        if (conversations.length === 0) {
            return (
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
            );
        }

        return (
            <div className="flex flex-col">
                {conversations.map(conv => {
                    const other = conv.participants.find(p => p._id !== currentUserId);
                    const isOnline = other ? onlineUserIds.has(other._id) : false;
                    return (
                        <button
                            key={conv._id}
                            onClick={() => setActiveConversation(conv)}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-[#ffffff05] transition-colors text-left border-b border-[#ffffff06]"
                        >
                            <div className="relative flex-shrink-0">
                                {other?.profilePictureUrl ? (
                                    <img src={other.profilePictureUrl} alt="" className="w-11 h-11 rounded-full object-cover" />
                                ) : (
                                    <div className="w-11 h-11 rounded-full bg-[#CEB888]/15 flex items-center justify-center text-sm font-bold text-[#CEB888]">
                                        {other?.displayName?.[0] || '?'}
                                    </div>
                                )}
                                <span
                                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#141414] ${isOnline ? 'bg-[#22c55e]' : 'bg-[#555]'}`}
                                />
                            </div>
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
        );
    };

    const renderMessageResults = () => {
        if (msgSearching) {
            return (
                <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-[#CEB888]/30 border-t-[#CEB888] rounded-full animate-spin" />
                </div>
            );
        }

        if (msgSearchRan && msgGroups.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <p className="text-sm text-[#777]">No messages found for "{msgQuery.trim()}"</p>
                </div>
            );
        }

        return (
            <div className="flex flex-col">
                {msgGroups.map((group) => {
                    const other = group.conversation.otherUser;
                    return (
                        <div key={group.conversation._id} className="border-b border-[#ffffff06]">
                            <div className="flex items-center gap-2 px-4 py-2 bg-[#0f0f0f]">
                                {other?.profilePictureUrl ? (
                                    <img src={other.profilePictureUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-[#CEB888]/15 flex items-center justify-center text-xs font-bold text-[#CEB888]">
                                        {other?.displayName?.[0] || '?'}
                                    </div>
                                )}
                                <p className="text-xs font-semibold text-[#CEB888] truncate">{other?.displayName || 'User'}</p>
                            </div>
                            <div className="flex flex-col">
                                {group.matches.map((m) => {
                                    const senderId = m.sender?._id || m.sender;
                                    const isMine = senderId === currentUserId;
                                    return (
                                        <button
                                            key={m._id}
                                            onClick={() => handleOpenResult(group, m._id)}
                                            className="px-4 py-2 text-left hover:bg-[#ffffff05] transition-colors flex flex-col gap-0.5"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[11px] text-[#888]">
                                                    {isMine ? 'You' : (m.sender?.displayName || 'User')}
                                                </p>
                                                <span className="text-[10px] text-[#555]">{formatTime(m.createdAt)}</span>
                                            </div>
                                            <p className="text-xs text-[#f5f5f5] break-words">
                                                {highlight(m.text, msgQuery)}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderRequests = () => {
        if (loadingRequests) {
            return (
                <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-[#CEB888]/30 border-t-[#CEB888] rounded-full animate-spin" />
                </div>
            );
        }

        if (requests.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#CEB888]/10 flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#CEB888]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="text-sm text-[#555]">No message requests</p>
                </div>
            );
        }

        return (
            <div className="flex flex-col">
                {requests.map(req => {
                    const sender = req.participants.find(p => p._id !== currentUserId);
                    return (
                        <div
                            key={req._id}
                            className="flex items-center gap-3 px-4 py-3 border-b border-[#ffffff06]"
                        >
                            {sender?.profilePictureUrl ? (
                                <img src={sender.profilePictureUrl} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                            ) : (
                                <div className="w-11 h-11 rounded-full bg-[#CEB888]/15 flex items-center justify-center text-sm font-bold text-[#CEB888] flex-shrink-0">
                                    {sender?.displayName?.[0] || '?'}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-[#f5f5f5] truncate">{sender?.displayName || 'User'}</p>
                                <p className="text-xs text-[#777] truncate mt-0.5">
                                    {req.messagePreview?.text || 'Sent you a message request'}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                    onClick={() => handleAcceptRequest(req._id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#22c55e]/15 text-[#22c55e] hover:bg-[#22c55e]/25 transition-colors"
                                >
                                    Accept
                                </button>
                                <button
                                    onClick={() => handleRejectRequest(req._id)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 transition-colors"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

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

                <div className="flex border-b border-[#CEB888]/10">
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${activeTab === 'inbox' ? 'text-[#CEB888]' : 'text-[#777] hover:text-[#aaa]'}`}
                    >
                        Inbox
                        {activeTab === 'inbox' && (
                            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#CEB888] rounded-full" />
                        )}
                    </button>
                    <button
                        onClick={() => { setActiveTab('requests'); loadRequests(); }}
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${activeTab === 'requests' ? 'text-[#CEB888]' : 'text-[#777] hover:text-[#aaa]'}`}
                    >
                        Requests
                        {requests.length > 0 && (
                            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#CEB888] text-black text-[10px] font-bold">
                                {requests.length > 9 ? '9+' : requests.length}
                            </span>
                        )}
                        {activeTab === 'requests' && (
                            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#CEB888] rounded-full" />
                        )}
                    </button>
                </div>

                {activeTab === 'inbox' && (
                    <div className="px-4 py-2 border-b border-[#CEB888]/10">
                        <div className="relative">
                            <svg className="w-4 h-4 text-[#555] absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={msgQuery}
                                onChange={(e) => handleMsgQueryChange(e.target.value)}
                                placeholder="Search messages..."
                                className="w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg pl-9 pr-3 py-2 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors"
                            />
                        </div>
                    </div>
                )}

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
                            <p className="text-xs text-[#555] mt-2 px-1">ERROR: No users found</p>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                    {activeTab === 'inbox' && msgQuery.trim().length >= 2
                        ? renderMessageResults()
                        : activeTab === 'inbox'
                            ? renderInbox()
                            : renderRequests()}
                </div>
            </div>
        </div>
    );
}
