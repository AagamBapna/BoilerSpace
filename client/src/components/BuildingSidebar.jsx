import { useState, useEffect } from 'react';
import axios from 'axios';
import SearchBar from './SearchBar';

export default function BuildingSidebar({ buildings, selectedBuilding, onSelectBuilding, onClose, user, onLogout, bookmarkedRoomIds = new Set(), onToggleBookmark }) {
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch rooms when a building is selected
    useEffect(() => {
        if (!selectedBuilding) {
            setRooms([]);
            return;
        }

        const fetchRooms = async () => {
            setLoadingRooms(true);
            try {
                const res = await axios.get(`/api/buildings/${selectedBuilding._id}/rooms`);
                setRooms(res.data);
            } catch (err) {
                console.error('Failed to fetch rooms:', err);
                setRooms([]);
            } finally {
                setLoadingRooms(false);
            }
        };

        fetchRooms();
    }, [selectedBuilding]);

    // Filter buildings by search query (kept in sync with SearchBar)
    const filteredBuildings = Array.isArray(buildings)
        ? buildings.filter(
            (b) =>
                b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                b.abbreviation.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    const noiseLevelIcon = {
        quiet: '🤫',
        moderate: '💬',
        loud: '📢',
    };

    return (
        <aside className="w-[360px] h-full bg-[var(--color-surface-light)] border-r border-white/5 flex flex-col overflow-hidden shrink-0">
            {/* Header */}
            <div className="p-5 border-b border-white/5">
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center">
                            <span className="text-black text-lg font-bold">B</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-[var(--color-purdue-gold)]">BoilerSpace</h1>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">Find your study spot</p>
                        </div>
                    </div>
                    {user && onLogout && (
                        <button
                            onClick={onLogout}
                            className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-purdue-gold)] transition-colors px-2 py-1"
                        >
                            Sign out
                        </button>
                    )}
                </div>

                {/* Search — uses reusable SearchBar component */}
                <SearchBar
                    buildings={buildings}
                    onSelectBuilding={(building) => {
                        setSearchQuery('');
                        onSelectBuilding(building);
                    }}
                    onSearchChange={setSearchQuery}
                />
            </div>

            {/* Selected building detail view */}
            {selectedBuilding ? (
                <div className="flex-1 overflow-y-auto">
                    {/* Back button */}
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-5 py-3 text-sm text-[var(--color-purdue-gold)] hover:bg-[var(--color-surface-hover)] w-full transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        All Buildings
                    </button>

                    {/* Building info */}
                    <div className="px-5 pb-4">
                        <h2 className="text-xl font-bold mb-1">{selectedBuilding.name}</h2>
                        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                            {selectedBuilding.abbreviation} · {selectedBuilding.address || 'Purdue University'}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-4">
                            {(selectedBuilding.amenities || []).map((a, i) => (
                                <span
                                    key={i}
                                    className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--color-purdue-gold)]/10 text-[var(--color-purdue-gold)] border border-[var(--color-purdue-gold)]/20"
                                >
                                    {a}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Rooms list */}
                    <div className="px-5 pb-5">
                        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                            Rooms ({rooms.length})
                        </h3>

                        {loadingRooms ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="w-6 h-6 border-2 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
                            </div>
                        ) : rooms.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">No rooms found</p>
                        ) : (
                            <div className="space-y-2">
                                {rooms.map((room) => (
                                    <div
                                        key={room._id}
                                        className="bg-[var(--color-surface)] rounded-xl p-4 border border-white/5 hover:border-[var(--color-purdue-gold)]/20 transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-sm">{room.name}</h4>
                                            <div className="flex items-center gap-2">
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
                                        <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                                            <span>👥 {room.capacity} seats</span>
                                            <span>{noiseLevelIcon[room.noiseLevel] || '💬'} {room.noiseLevel}</span>
                                        </div>
                                        {room.amenities?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {room.amenities.map((a, i) => (
                                                    <span
                                                        key={i}
                                                        className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-text-secondary)]"
                                                    >
                                                        {a}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Building list view */
                <div className="flex-1 overflow-y-auto">
                    {/* Legend */}
                    <div className="px-5 py-3 border-b border-white/5">
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium mb-2">Status Legend</p>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-status-open)]" />
                                <span className="text-[11px] text-[var(--color-text-secondary)]">Quiet</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-status-moderate)]" />
                                <span className="text-[11px] text-[var(--color-text-secondary)]">Moderate</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-status-busy)]" />
                                <span className="text-[11px] text-[var(--color-text-secondary)]">Busy</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-3">
                        <p className="text-xs text-[var(--color-text-secondary)] px-2 mb-2">
                            {filteredBuildings.length} building{filteredBuildings.length !== 1 ? 's' : ''}
                        </p>
                        {filteredBuildings.length === 0 ? (
                            <p className="text-sm text-[var(--color-text-secondary)] text-center py-8">
                                No buildings found matching "{searchQuery}"
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {filteredBuildings.map((building) => (
                                    <button
                                        key={building._id}
                                        onClick={() => onSelectBuilding(building)}
                                        className="w-full text-left px-3 py-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors group flex items-center gap-3"
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