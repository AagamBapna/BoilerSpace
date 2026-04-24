import { useState, useEffect } from 'react';
import axios from 'axios';

export default function NotificationBell({ onSelectBuilding, buildings, socket, onOpenCourseNotes, isMuted }) {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/api/notifications');
            setNotifications(res.data);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket?.current) {
            return;
        }
        const s = socket.current;
        const handler = (data) => {
            setNotifications((prev) => [data.notification, ...prev]);
        };
        s.on('notification', handler);
        return () => {
            s.off('notification', handler);
        };
    }, [socket]);

    const unreadCount = isMuted ? 0 : notifications.filter((n) => !n.read).length;

    const handleClick = async (notification) => {
        try {
            await axios.patch(`/api/notifications/${notification._id}/read`);
            setNotifications((prev) =>
                prev.map((n) => n._id === notification._id ? { ...n, read: true } : n)
            );
            if (notification.type === 'noteUpload' && notification.courseId) {
                const courseId = notification.courseId._id || notification.courseId;
                onOpenCourseNotes(courseId);
            }
            else if (notification.type === 'event' && notification.eventId) {
                const eventId = notification.eventId._id || notification.eventId;
                window.location.href = `/events/${eventId}`;
            }
            else {
                const building = buildings.find(
                    (b) => b._id === notification.buildingId?._id || b._id === notification.buildingId
                );
                if (building) {
                    onSelectBuilding(building);
                }
                setIsOpen(false);
            }
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const timeAgo = (date) => {
        const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="profile-button-like"
                style={{ position: 'relative' }}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#ef4444',
                        color: 'white',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '11px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    zIndex: 50,
                }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-sm font-semibold">Notifications</p>
                    </div>

                    {notifications.length === 0 ? (
                        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                            <p className="text-xs text-[var(--color-text-secondary)]">No notifications yet</p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <button
                                key={n._id}
                                onClick={() => handleClick(n)}
                                className="w-full text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    opacity: n.read ? 0.5 : 1,
                                }}
                            >
                                <div className="flex items-start" style={{ gap: '10px' }}>
                                    {!n.read && (
                                        <span style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: '#ef4444',
                                            marginTop: '5px',
                                            flexShrink: 0,
                                        }} />
                                    )}
                                    <div>
                                        <p className="text-xs" style={{ marginBottom: '4px' }}>{n.message}</p>
                                        <p className="text-xs text-[var(--color-text-secondary)]">{timeAgo(n.createdAt)}</p>
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}