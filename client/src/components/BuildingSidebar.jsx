import { useState, useEffect } from 'react';
import axios from 'axios';
import SearchBar from './SearchBar';
import BookmarkedRooms from './BookmarkedRooms';
import SnackIndicator from './SnackIndicator';
import SnackReporter from './SnackReporter';
import { formatRelative, formatAbsolute } from '../utils/formatRelative';


export default function BuildingSidebar({ buildings, selectedBuilding, onSelectBuilding, onClose, user, onLogout, bookmarkedRoomIds = new Set(), onToggleBookmark, bookmarks = [], recentBuildings = [], onRefreshRecentBuildings }) {
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarView, setSidebarView] = useState('buildings');
    const [activeCheckIn, setActiveCheckIn] = useState(null);
    const [thresholdRoom, setThresholdRoom] = useState(null);
    const [thresholdValue, setThresholdValue] = useState(50);
    const [snackData, setSnackData] = useState(null);
    const [showSnackReporter, setShowSnackReporter] = useState(false);

    const fetchRooms = async () => {
        if (!selectedBuilding) return;
        try {
            const res = await axios.get(`/api/buildings/${selectedBuilding._id}/rooms`);
            setRooms(res.data);
        } catch (err) {
            console.error('Failed to fetch rooms:', err);
        }
    };

    useEffect(() => {
        if (!selectedBuilding) {
            setRooms([]);
            setSnackData(null);
            setShowSnackReporter(false);
            return;
        }
        fetchRooms();
        // Fetch snack data for selected building
        axios.get(`/api/buildings/${selectedBuilding._id}/snacks`)
            .then(res => setSnackData(res.data))
            .catch(() => setSnackData(null));
        const interval = setInterval(fetchRooms, 5000);
        return () => clearInterval(interval);
    }, [selectedBuilding]);

    useEffect(() => {
        if (!activeCheckIn) return;
        const delay = new Date(activeCheckIn.expiresAt) - Date.now();
        const timer = setTimeout(() => {
            setActiveCheckIn(null);
        }, delay);
        return () => clearTimeout(timer);
    }, [activeCheckIn]);

    const filteredBuildings = Array.isArray(buildings)
        ? buildings.filter(
            (b) =>
                b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.abbreviation.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    const noiseLevelIcon = {
        quiet: 'Quiet',
        moderate: 'Moderate',
        loud: 'Loud',
    };

    const amenityIcons = {
        'Whiteboard': 'WB',
        'Outlets': 'Outlet',
        'Projector': 'Proj',
        'Printers': 'Print',
        'Cafe': 'Cafe',
        'Lab': 'Lab',
    };
    const timeAgo = (date) => {
        if (!date) return null;
        const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };
    return (
        <aside
            className="w-[360px] h-full border-r border-white/5 flex flex-col overflow-hidden shrink-0"
            style={{ background: '#111111' }}
        >
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#1a1a1a' }}>
                <div className="flex items-center justify-between" style={{ gap: '12px', marginBottom: '16px' }}>
                    <div className="flex items-center" style={{ gap: '12px' }}>
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center">
                            <span className="text-black text-lg font-bold">B</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[var(--color-purdue-gold)]">BoilerSpace</h1>
                            <p className="text-[var(--color-text-secondary)]" style={{ fontSize: '11px' }}>Find your study spot</p>
                        </div>
                    </div>
                    {user && onLogout && (
                        <button
                            onClick={onLogout}
                            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-purdue-gold)] transition-colors"
                            style={{ padding: '4px 8px' }}
                        >
                            Sign out
                        </button>
                    )}
                </div>

                <SearchBar
                    buildings={buildings}
                    onSelectBuilding={(building) => {
                        setSearchQuery('');
                        onSelectBuilding(building);
                    }}
                    onSearchChange={setSearchQuery}
                />
            </div>

            {/* Tab toggle only show when no building is selected */}
            {!selectedBuilding && (
                <div className="flex border-b border-white/5" style={{ background: '#1a1a1a' }}>
                    <button
                        onClick={() => setSidebarView('buildings')}
                        className={`flex-1 text-xs font-medium transition-colors ${sidebarView === 'buildings'
                            ? 'text-[var(--color-purdue-gold)] border-b-2 border-[var(--color-purdue-gold)]'
                            : 'text-[var(--color-text-secondary)] hover:text-white'
                            }`}
                        style={{ padding: '10px 0' }}
                    >
                        🏠 Buildings
                    </button>
                    <button
                        onClick={() => setSidebarView('bookmarks')}
                        className={`flex-1 text-xs font-medium transition-colors ${sidebarView === 'bookmarks'
                            ? 'text-[var(--color-purdue-gold)] border-b-2 border-[var(--color-purdue-gold)]'
                            : 'text-[var(--color-text-secondary)] hover:text-white'
                            }`}
                        style={{ padding: '10px 0' }}
                    >
                        ♥ My Rooms {bookmarks.length > 0 && `(${bookmarks.length})`}
                    </button>
                </div>
            )}

            {/* Selected building detail view */}
            {selectedBuilding ? (
                <div className="flex-1 overflow-y-auto">
                    {/* Back button */}
                    <button
                        onClick={onClose}
                        className="flex items-center text-sm text-[var(--color-purdue-gold)] hover:bg-[var(--color-surface-hover)] w-full transition-colors"
                        style={{ gap: '8px', padding: '12px 20px', background: '#161616' }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        All Buildings
                    </button>

                    {/* Building info */}
                    <div style={{ padding: '16px 20px', background: '#161616', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center" style={{ gap: '10px', marginBottom: '4px' }}>
                            <h2 className="text-xl font-bold">{selectedBuilding.name}</h2>
                            <SnackIndicator snackData={snackData} onOpenReporter={() => setShowSnackReporter(prev => !prev)} />
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)]" style={{ marginBottom: '12px' }}>
                            {selectedBuilding.abbreviation} · {selectedBuilding.address || 'Purdue University'}
                        </p>
                        <div className="flex flex-wrap" style={{ gap: '6px' }}>
                            {(selectedBuilding.amenities || []).map((a, i) => (
                                <span
                                    key={i}
                                    className="text-[var(--color-purdue-gold)]"
                                    style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', background: 'rgba(206,184,136,0.1)', border: '1px solid rgba(206,184,136,0.2)' }}
                                >
                                    {a}
                                </span>
                            ))}
                        </div>
                        {showSnackReporter && (
                            <SnackReporter
                                buildingId={selectedBuilding._id}
                                snackData={snackData}
                                user={user}
                                onUpdate={(updated) => setSnackData(prev => ({ ...prev, ...updated }))}
                                onClose={() => setShowSnackReporter(false)}
                            />
                        )}
                    </div>

                    {/* Rooms list */}
                    <div style={{ padding: '16px 20px 20px', background: '#111111' }}>
                        <p className="text-xs text-[var(--color-text-secondary)]" style={{ marginBottom: '8px' }}>
                            {rooms.reduce((sum, room) => sum + (room.currentOccupancy || 0), 0)} checked in across all rooms
                        </p>
                        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase" style={{ letterSpacing: '0.05em', marginBottom: '12px' }}>
                            Rooms ({rooms.length})
                        </h3>

                        {loadingRooms ? (
                            <div className="flex items-center justify-center" style={{ padding: '32px 0' }}>
                                <div className="w-6 h-6 border-2 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
                            </div>
                        ) : rooms.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-secondary)] text-center" style={{ padding: '16px 0' }}>No rooms found</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {rooms.map((room) => (
                                    <div
                                        key={room._id}
                                        className="rounded-xl border border-white/5 hover:border-[var(--color-purdue-gold)]/20"
                                        style={{ padding: '16px', background: '#1a1a1a', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease' }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(206,184,136,0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
                                            <h4 className="font-semibold text-sm">{room.name}</h4>
                                            <div className="flex items-center" style={{ gap: '8px' }}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleBookmark?.(room._id, bookmarkedRoomIds.has(room._id));
                                                    }}
                                                    className={`bookmark-btn ${bookmarkedRoomIds.has(room._id) ? 'active' : ''}`}
                                                    aria-label={bookmarkedRoomIds.has(room._id) ? 'Remove bookmark' : 'Bookmark room'}
                                                    title={bookmarkedRoomIds.has(room._id) ? 'Remove bookmark' : 'Bookmark room'}
                                                >
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill={bookmarkedRoomIds.has(room._id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                    </svg>
                                                </button>
                                                <span className="text-xs text-[var(--color-text-secondary)]">
                                                    Floor {room.floor}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center text-xs text-[var(--color-text-secondary)]" style={{ gap: '12px' }}>
                                            <span>{room.capacity} seats</span>
                                            <span>{noiseLevelIcon[room.noiseLevel] || 'Moderate'} {room.noiseLevel}</span>
                                            <span>Current occupancy: {room.currentOccupancy}</span>
                                            <span className="timestamp-tooltip" data-tooltip={formatAbsolute(room.lastStatusUpdate)} tabIndex={0}>
                                                Last updated: {formatRelative(room.lastStatusUpdate)}
                                            </span>
                                        </div>
                                        {room.amenities?.length > 0 && (
                                            <div className="flex flex-wrap" style={{ gap: '4px', marginTop: '8px' }}>
                                                {room.amenities.map((a, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-[var(--color-text-secondary)]"
                                                        style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)' }}
                                                    >
                                                        {amenityIcons[a] || '•'} {a}
                                                    </span>
                                                ))}
                                            </div>
                                            
                                        )}
                                        {room.lastActivityAt && (
                                            <p className="text-xs text-[var(--color-text-secondary)]" style={{ marginTop: '8px', opacity: 0.6 }}>
                                                Last activity {timeAgo(room.lastActivityAt)}
                                            </p>
                                        )}
                                        {thresholdRoom === room._id ? (
                                            <div className="flex items-center" style={{ gap: '8px', marginTop: '8px' }}>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={thresholdValue}
                                                    onChange={(e) => setThresholdValue(Number(e.target.value))}
                                                    className="text-xs bg-[var(--color-surface)] border border-white/10 rounded px-2 py-1 text-white"
                                                    style={{ width: '60px' }}
                                                />
                                                <span className="text-xs text-[var(--color-text-secondary)]">%</span>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            await axios.post('/api/notifications/preferences', {
                                                                roomId: room._id,
                                                                threshold: thresholdValue,
                                                            });
                                                            setThresholdRoom(null);
                                                            alert('Alert saved!');
                                                        } catch (err) {
                                                            alert(err.response?.data?.error || 'Failed to save alert');
                                                        }
                                                    }}
                                                    className="text-xs px-2 py-1 rounded"
                                                    style={{ background: 'var(--color-purdue-gold)', color: 'black', fontWeight: '600' }}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setThresholdRoom(null)}
                                                    className="text-xs text-[var(--color-text-secondary)] hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setThresholdRoom(room._id); setThresholdValue(50); }}
                                                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-purdue-gold)] transition-colors"
                                                style={{ marginTop: '8px' }}
                                            >
                                                🔔 Set capacity alert
                                            </button>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        if (activeCheckIn?.roomId === room._id) {
                                                            await axios.delete(`/api/buildings/${activeCheckIn.buildingId}/rooms/${activeCheckIn.roomId}/checkins/${activeCheckIn._id}`);
                                                            setActiveCheckIn(null);
                                                        } else {
                                                            if (activeCheckIn) {
                                                                await axios.delete(`/api/buildings/${activeCheckIn.buildingId}/rooms/${activeCheckIn.roomId}/checkins/${activeCheckIn._id}`);
                                                            }
                                                            const res = await axios.post(`/api/buildings/${selectedBuilding._id}/rooms/${room._id}/checkins`);
                                                            setActiveCheckIn(res.data);
                                                            if (onRefreshRecentBuildings) onRefreshRecentBuildings();
                                                        }
                                                        await fetchRooms();
                                                    } catch (err) {
                                                        alert(err.response?.data?.error || 'Failed');
                                                    }
                                                }}
                                                style={{
                                                    padding: '8px 32px',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    border: 'none',
                                                    transition: 'all 0.2s ease',
                                                    background: activeCheckIn?.roomId === room._id ? '#ef4444' : 'var(--color-purdue-gold)',
                                                    color: activeCheckIn?.roomId === room._id ? 'white' : 'black',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1.05)';
                                                    e.currentTarget.style.opacity = '0.9';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                    e.currentTarget.style.opacity = '1';
                                                }}
                                            >
                                                {activeCheckIn?.roomId === room._id ? 'Check Out' : 'Check In'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : sidebarView === 'bookmarks' ? (
                <BookmarkedRooms
                    bookmarks={bookmarks}
                    onToggleBookmark={onToggleBookmark}
                    onSelectBuilding={(building) => {
                        setSidebarView('buildings');
                        onSelectBuilding(building);
                    }}
                    buildings={buildings}
                />
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* Legend */}
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#161616' }}>
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium" style={{ marginBottom: '8px' }}>Status Legend</p>
                        <div className="flex" style={{ gap: '16px' }}>
                            <div className="flex items-center" style={{ gap: '6px' }}>
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-status-open)]" />
                                <span className="text-[var(--color-text-secondary)]" style={{ fontSize: '11px' }}>Quiet</span>
                            </div>
                            <div className="flex items-center" style={{ gap: '6px' }}>
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-status-moderate)]" />
                                <span className="text-[var(--color-text-secondary)]" style={{ fontSize: '11px' }}>Moderate</span>
                            </div>
                            <div className="flex items-center" style={{ gap: '6px' }}>
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-status-busy)]" />
                                <span className="text-[var(--color-text-secondary)]" style={{ fontSize: '11px' }}>Busy</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '12px' }}>
                        {recentBuildings.length > 0 && (
                            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <p className="text-xs text-[var(--color-text-secondary)] font-medium uppercase"
                                style={{ padding: '0 8px', marginBottom: '8px', letterSpacing: '0.05em' }}>
                                    Recently Visited
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {recentBuildings.filter((entry) => entry.buildingId).map((entry) => (
                                        <button
                                            key={entry.buildingId._id}
                                            onClick={() => onSelectBuilding(entry.buildingId)}
                                            className="w-full text-left rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors group flex items-center"
                                            style={{ padding: '12px', gap: '12px' }}
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-[var(--color-purdue-gold)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--color-purdue-gold)]/20 transition-colors">
                                                <span className="text-xs font-bold text-[var(--color-purdue-gold)]">
                                                    {entry.buildingId.abbreviation}
                                                </span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{entry.buildingId.name}</p>
                                                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                                                    {(entry.buildingId.amenities || []).slice(0, 3).join(' · ')}
                                                </p>
                                            </div>
                                            <svg
                                                className="w-4 h-4 text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-[var(--color-text-secondary)]" style={{ padding: '0 8px', marginBottom: '8px' }}>
                            {filteredBuildings.length} building{filteredBuildings.length !== 1 ? 's' : ''}
                        </p>
                        {filteredBuildings.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-secondary)] text-center" style={{ padding: '32px 0' }}>
                                No buildings found matching "{searchQuery}"
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {filteredBuildings.map((building) => (
                                    <button
                                        key={building._id}
                                        onClick={() => onSelectBuilding(building)}
                                        className="w-full text-left rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors group flex items-center"
                                        style={{ padding: '12px', gap: '12px' }}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-[var(--color-purdue-gold)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--color-purdue-gold)]/20 transition-colors">
                                            <span className="text-xs font-bold text-[var(--color-purdue-gold)]">
                                                {building.abbreviation}
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{building.name}</p>
                                            <p className="text-xs text-[var(--color-text-secondary)] truncate">
                                                {(building.amenities || []).slice(0, 3).join(' · ')}
                                            </p>
                                        </div>
                                        <svg
                                            className="w-4 h-4 text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </aside>
    );
}