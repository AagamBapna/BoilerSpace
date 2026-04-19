import { useState, useEffect } from 'react';
import axios from 'axios';
import SearchBar from './SearchBar';
import BookmarkedRooms from './BookmarkedRooms';
import SnackIndicator from './SnackIndicator';
import SnackReporter from './SnackReporter';
import { formatRelative, formatAbsolute } from '../utils/formatRelative';
import { useLocation } from '../contexts/LocationContext';
import RoomReviews from './RoomReviews';


export default function BuildingSidebar({ buildings, selectedBuilding, onSelectBuilding, onClose, user, onLogout, bookmarkedRoomIds = new Set(), onToggleBookmark, bookmarks = [], recentBuildings = [], onRefreshRecentBuildings, isQuietZonesOnly }) {
    const [rooms, setRooms] = useState([]);
    const [selectedAmenities, setSelectedAmenities] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarView, setSidebarView] = useState('buildings');
    const [activeCheckIn, setActiveCheckIn] = useState(null);
    const [thresholdRoom, setThresholdRoom] = useState(null);
    const [thresholdValue, setThresholdValue] = useState(50);
    const [showingOriginSelector, setShowingOriginSelector] = useState(false);
    const { locationStatus, userLocation, requestLocationAccess, resetLocationStatus, disableLocationAccess } = useLocation();
    const [snackData, setSnackData] = useState(null);
    const [showSnackReporter, setShowSnackReporter] = useState(false);
    const [expandedReviewsRoomId, setExpandedReviewsRoomId] = useState(null);

    useEffect(() => {
        if (!userLocation) {
            requestLocationAccess();
        }
    }, []);

    const fetchRooms = async () => {
        if (!selectedBuilding) return;
        try {
            const params = {};
            if (selectedAmenities.length > 0) {
                params.amenities = selectedAmenities.join(',');
            }
            const res = await axios.get(`/api/buildings/${selectedBuilding._id}/rooms`, { params });
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
        setSelectedAmenities([]);
        // Fetch snack data for selected building
        axios.get(`/api/buildings/${selectedBuilding._id}/snacks`)
            .then(res => setSnackData(res.data))
            .catch(() => setSnackData(null));
    }, [selectedBuilding]);

    useEffect(() => {
        if (!selectedBuilding) {
            return;
        }
        fetchRooms();
        const interval = setInterval(fetchRooms, 5000);
        return () => clearInterval(interval);
    }, [selectedBuilding, selectedAmenities]);

    useEffect(() => {
        if (!activeCheckIn) return;
        const delay = new Date(activeCheckIn.expiresAt) - Date.now();
        const timer = setTimeout(() => {
            setActiveCheckIn(null);
        }, delay);
        return () => clearTimeout(timer);
    }, [activeCheckIn]);

    const calcDistance = (lat1, lon1, lat2, lon2) => {
        const R = 3958.8;
        const latDistance = (lat2 - lat1) * Math.PI / 180;
        const lonDistance = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(latDistance / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(lonDistance / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const filteredBuildings = Array.isArray(buildings)
        ? buildings.filter(
            (b) =>
                b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.abbreviation.toLowerCase().includes(searchQuery.toLowerCase())
        )
            .map(b => ({
                ...b,
                distance: userLocation ? calcDistance(userLocation[1], userLocation[0], b.latitude, b.longitude) : null
            }))
            .sort((a, b) => {
                if (a.distance !== null && b.distance !== null) {
                    return a.distance - b.distance;
                }
                return 0;
            })
        : [];

    const noiseClassificationIcon = {
        quiet: '🤫 Quiet',
        moderate: '🗣️ Moderate',
        collaborative: '🔊 Collaborative',
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
                            {selectedBuilding.distance != null && ` · ${selectedBuilding.distance.toFixed(2)} mi away`}
                        </p>
                        <div className="flex flex-wrap" style={{ gap: '6px', marginBottom: '16px' }}>
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
                        {showingOriginSelector ? (
                            <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[var(--color-purdue-gold)]/20 mt-2 flex flex-col gap-3 shadow-2xl">
                                <div>
                                    <p className="text-[11px] text-[var(--color-text-secondary)] mb-2 font-semibold uppercase tracking-wider">Select Starting Point</p>
                                    <SearchBar
                                        buildings={buildings.filter(b => b._id !== selectedBuilding._id)}
                                        onSelectBuilding={(building) => {
                                            setShowingOriginSelector(false);
                                            document.dispatchEvent(new CustomEvent('getDirections', { detail: { destId: selectedBuilding._id, originId: building._id } }));
                                        }}
                                        onSearchChange={() => { }}
                                    />
                                </div>
                                <div className="text-center relative py-1">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
                                    <span className="relative bg-[#1a1a1a] px-3 text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-widest">OR</span>
                                </div>
                                <button
                                    onClick={() => { setShowingOriginSelector(false); resetLocationStatus(); }}
                                    className="w-full py-2.5 bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 border border-[#ef4444]/30 rounded-lg text-xs font-semibold transition-all flex justify-center items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Enable GPS Location
                                </button>
                                <button onClick={() => setShowingOriginSelector(false)} className="mx-auto mt-0.5 text-[11px] text-[var(--color-text-secondary)] hover:text-white transition-colors">Cancel</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <button
                                    onClick={() => {
                                        if (locationStatus === 'denied') {
                                            setShowingOriginSelector(true);
                                        } else {
                                            document.dispatchEvent(new CustomEvent('getDirections', { detail: selectedBuilding._id }));
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, var(--color-purdue-gold), var(--color-purdue-rush))',
                                        color: 'black',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Get Walking Directions
                                </button>

                                {locationStatus === 'granted' && (
                                    <button
                                        onClick={() => {
                                            disableLocationAccess();
                                            document.dispatchEvent(new CustomEvent('clearDirections'));
                                        }}
                                        className="text-[11px] text-[var(--color-text-secondary)] hover:text-[#ef4444] transition-colors mx-auto"
                                        style={{ marginTop: '2px' }}
                                    >
                                        Disable Location
                                    </button>
                                )}
                            </div>
                        )}
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

                    {/* Amenity Filter */}
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium uppercase"
                            style={{ marginBottom: '8px', letterSpacing: '0.05em' }}>
                            Filter by Amenity
                        </p>
                        <div className="flex flex-wrap" style={{ gap: '6px' }}>
                            {['Whiteboard', 'Projector', 'Outlets', 'Cafe', 'Lab', 'Printers'].map((amenity) => {
                                const isActive = selectedAmenities.includes(amenity);
                                return (
                                    <button
                                        key={amenity}
                                        onClick={() => {
                                            setSelectedAmenities((prev) =>
                                                isActive
                                                    ? prev.filter((a) => a !== amenity)
                                                    : [...prev, amenity]
                                            );
                                        }}
                                        className={`text-xs font-medium transition-all ${isActive
                                            ? 'text-black bg-[var(--color-purdue-gold)]'
                                            : 'text-[var(--color-text-secondary)] hover:text-white'
                                            }`}
                                        style={{
                                            padding: '5px 12px',
                                            borderRadius: '20px',
                                            border: isActive
                                                ? '1px solid var(--color-purdue-gold)'
                                                : '1px solid rgba(255,255,255,0.1)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {amenity}
                                    </button>
                                );
                            })}
                        </div>
                        {selectedAmenities.length > 0 && (
                            <button
                                onClick={() => setSelectedAmenities([])}
                                className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-purdue-gold)] transition-colors"
                                style={{ marginTop: '8px' }}
                            >
                                Clear filters
                            </button>
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
                                {rooms
                                    .filter(r => !isQuietZonesOnly || r.noiseClassification === 'Quiet')
                                    .map((room) => (
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
                                                <span>{noiseClassificationIcon[room.noiseClassification?.toLowerCase()] || '🗣️ Moderate'}</span>
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
                                            {thresholdRoom === room._id ? (
                                                <div className="flex items-center justify-between" style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <div className="flex items-center" style={{ gap: '8px' }}>
                                                        <span className="text-xs text-[var(--color-text-secondary)] font-medium">Alert me at:</span>
                                                        <div className="flex items-center relative">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="100"
                                                                value={thresholdValue}
                                                                onChange={(e) => setThresholdValue(Number(e.target.value))}
                                                                className="text-sm font-semibold rounded-md text-white focus:outline-none focus:border-[var(--color-purdue-gold)] transition-colors"
                                                                style={{ width: '64px', padding: '4px 8px', paddingRight: '20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                            />
                                                            <span className="absolute right-2 text-xs text-[var(--color-text-secondary)] pointer-events-none">%</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center" style={{ gap: '6px' }}>
                                                        <button
                                                            onClick={() => setThresholdRoom(null)}
                                                            className="text-xs font-medium px-3 py-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
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
                                                            className="text-xs font-bold px-4 py-1.5 rounded-md text-black transition-transform hover:scale-105"
                                                            style={{ background: 'var(--color-purdue-gold)' }}
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setThresholdRoom(room._id); setThresholdValue(50); }}
                                                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-purdue-gold)] transition-colors flex items-center gap-1.5"
                                                    style={{ marginTop: '12px' }}
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                    </svg>
                                                    Set capacity alert
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
                                            <div style={{ marginTop: '12px' }}>
                                                <button
                                                    onClick={() => setExpandedReviewsRoomId(prev => prev === room._id ? null : room._id)}
                                                    className="w-full text-center text-xs font-semibold py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[var(--color-text-secondary)] hover:text-white transition-colors"
                                                >
                                                    {expandedReviewsRoomId === room._id ? 'Hide Reviews' : 'Show Reviews'}
                                                </button>
                                                {expandedReviewsRoomId === room._id && (
                                                    <RoomReviews roomId={room._id} user={user} />
                                                )}
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
                                            {building.distance !== null && (
                                                <p className="text-xs text-[var(--color-purdue-gold)]" style={{ marginTop: '2px' }}>
                                                    {building.distance < 0.1
                                                        ? `${Math.round(building.distance * 5280)} ft away`
                                                        : `${building.distance.toFixed(2)} mi away`}
                                                </p>
                                            )}
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