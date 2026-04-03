import { useState } from 'react';

/**
 * Small inline icons showing cafe/vending snack status next to building name.
 * - Green filled = present (score >= 60%)
 * - Gray outline = unknown/absent
 * Clicking opens the SnackReporter.
 */
export default function SnackIndicator({ snackData, onOpenReporter }) {
    const cafe = snackData?.cafeScore ?? 0;
    const vending = snackData?.vendingScore ?? 0;
    const cafeCount = snackData?.cafeCount ?? 0;
    const vendingCount = snackData?.vendingCount ?? 0;

    const cafeActive = cafeCount > 0 && cafe >= 60;
    const vendingActive = vendingCount > 0 && vending >= 60;

    return (
        <div
            className="flex items-center"
            style={{ gap: '6px', cursor: 'pointer' }}
            onClick={(e) => {
                e.stopPropagation();
                onOpenReporter?.();
            }}
            title="Click to report snack availability"
        >
            {/* Cafe icon */}
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '11px',
                    color: cafeActive ? 'var(--color-status-open)' : 'var(--color-text-secondary)',
                    opacity: cafeActive ? 1 : 0.5,
                    transition: 'color 0.2s, opacity 0.2s',
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
                    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
                    <line x1="6" y1="2" x2="6" y2="4" />
                    <line x1="10" y1="2" x2="10" y2="4" />
                    <line x1="14" y1="2" x2="14" y2="4" />
                </svg>
                {cafeCount > 0 && <span style={{ fontSize: '10px' }}>{cafe}%</span>}
            </span>

            {/* Vending icon */}
            <span
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontSize: '11px',
                    color: vendingActive ? 'var(--color-status-open)' : 'var(--color-text-secondary)',
                    opacity: vendingActive ? 1 : 0.5,
                    transition: 'color 0.2s, opacity 0.2s',
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <line x1="9" y1="10" x2="15" y2="10" />
                    <line x1="12" y1="7" x2="12" y2="13" />
                    <rect x="8" y="16" width="8" height="3" rx="1" />
                </svg>
                {vendingCount > 0 && <span style={{ fontSize: '10px' }}>{vending}%</span>}
            </span>
        </div>
    );
}
