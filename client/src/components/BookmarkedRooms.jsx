import { useState } from 'react';
import { formatRelative, formatAbsolute } from '../utils/formatRelative';

export default function BookmarkedRooms({ bookmarks = [], onToggleBookmark, onSelectBuilding, buildings }) {
    const noiseClassificationIcon = {
        quiet: 'Quiet',
        moderate: 'Moderate',
        loud: 'Loud',
    };

    const getOccupancyStatus = (room) => {
        const ratio = (room.currentOccupancy || 0) / (room.capacity || 1);
        if (ratio < 0.4) return { label: 'Quiet', color: 'var(--color-status-open)' };
        if (ratio < 0.7) return { label: 'Moderate', color: 'var(--color-status-moderate)' };
        return { label: 'Busy', color: 'var(--color-status-busy)' };
    };

    if (bookmarks.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-purdue-gold)]/10 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-[var(--color-purdue-gold)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                </div>
                <h3 className="text-sm font-semibold mb-1">No bookmarked rooms yet</h3>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-[200px]">
                    Tap the heart icon on any room to save it here for quick access.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-3 border-b border-white/5">
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                    {bookmarks.length} bookmarked room{bookmarks.length !== 1 ? 's' : ''}
                </p>
            </div>

            <div className="p-3 space-y-2">
                {bookmarks.map((room) => {
                    const building = room.buildingId;
                    const occupancy = getOccupancyStatus(room);

                    return (
                        <div
                            key={room._id}
                            className="bg-[var(--color-surface)] rounded-xl p-4 border border-white/5 hover:border-[var(--color-purdue-gold)]/20 transition-colors"
                        >
                            {/* Room header with building info */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-semibold text-sm">{room.name}</h4>
                                    {building && (
                                        <button
                                            onClick={() => {
                                                const fullBuilding = buildings?.find(
                                                    (b) => b._id === building._id
                                                );
                                                if (fullBuilding) onSelectBuilding?.(fullBuilding);
                                            }}
                                            className="text-xs text-[var(--color-purdue-gold)] hover:underline"
                                        >
                                            {building.abbreviation || ''} · {building.name || ''}
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => onToggleBookmark?.(room._id, true)}
                                        className="bookmark-btn active"
                                        aria-label="Remove bookmark"
                                        title="Remove bookmark"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Room details */}
                            <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] mb-2">
                                <span>{room.capacity} seats</span>
                                <span>{noiseClassificationIcon[room.noiseClassification] || 'Moderate'} {room.noiseClassification}</span>
                                <span>Floor {room.floor}</span>
                            </div>

                            {/* Occupancy status */}
                            <div className="flex items-center gap-2 mb-2">
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: occupancy.color }}
                                />
                                <span className="text-xs font-medium" style={{ color: occupancy.color }}>
                                    {occupancy.label}
                                </span>
                                <span className="text-xs text-[var(--color-text-secondary)]">
                                    — {room.currentOccupancy || 0}/{room.capacity} checked in
                                </span>
                            </div>

                            {/* Last status update */}
                            <div className="text-xs text-[var(--color-text-secondary)] mb-2">
                                <span className="timestamp-tooltip" data-tooltip={formatAbsolute(room.lastStatusUpdate)} tabIndex={0}>
                                    Last updated: {formatRelative(room.lastStatusUpdate)}
                                </span>
                            </div>

                            {/* Amenities */}
                            {room.amenities?.length > 0 && (
                                <div className="flex flex-wrap gap-1">
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
                    );
                })}
            </div>
        </div>
    );
}
