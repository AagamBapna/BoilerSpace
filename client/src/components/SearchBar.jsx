import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Highlight matched substrings in text with <mark> tags.
 */
function HighlightMatch({ text, query }) {
    if (!query.trim()) return <>{text}</>;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    const q = query.trim().toLowerCase();
    return (
        <>
            {parts.map((part, i) =>
                q && part.toLowerCase() === q ? (
                    <mark key={i} className="search-highlight">
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
}

export default function SearchBar({ buildings = [], onSelectBuilding, onSearchChange }) {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef(null);
    const resultsRef = useRef(null);

    // Debounce the query (200ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(query);
            setActiveIndex(-1);
        }, 200);
        return () => clearTimeout(timer);
    }, [query]);

    // Notify parent of query changes so the building list can filter in sync
    useEffect(() => {
        onSearchChange?.(debouncedQuery);
    }, [debouncedQuery, onSearchChange]);

    // Filter buildings by debounced query
    const filteredBuildings = buildings.filter((b) => {
        if (!debouncedQuery.trim()) return true;
        const q = debouncedQuery.toLowerCase();
        return (
            b.name.toLowerCase().includes(q) ||
            b.abbreviation.toLowerCase().includes(q)
        );
    });

    // Sort: exact abbreviation match first, then alphabetical
    const sortedResults = [...filteredBuildings].sort((a, b) => {
        if (!debouncedQuery.trim()) return a.name.localeCompare(b.name);
        const q = debouncedQuery.toLowerCase();
        const aExact = a.abbreviation.toLowerCase() === q;
        const bExact = b.abbreviation.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return a.name.localeCompare(b.name);
    });

    const handleSelect = useCallback(
        (building) => {
            onSelectBuilding(building);
            setQuery('');
            setDebouncedQuery('');
            setActiveIndex(-1);
            inputRef.current?.blur();
        },
        [onSelectBuilding]
    );

    const handleKeyDown = useCallback(
        (e) => {
            if (!sortedResults.length) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setActiveIndex((prev) =>
                        prev < sortedResults.length - 1 ? prev + 1 : 0
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setActiveIndex((prev) =>
                        prev > 0 ? prev - 1 : sortedResults.length - 1
                    );
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (activeIndex >= 0 && activeIndex < sortedResults.length) {
                        handleSelect(sortedResults[activeIndex]);
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    setQuery('');
                    setDebouncedQuery('');
                    setActiveIndex(-1);
                    inputRef.current?.blur();
                    break;
                default:
                    break;
            }
        },
        [sortedResults, activeIndex, handleSelect]
    );

    // Scroll active item into view
    useEffect(() => {
        if (activeIndex < 0 || !resultsRef.current) return;
        const activeEl = resultsRef.current.children[activeIndex];
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex]);

    const handleClear = () => {
        setQuery('');
        setDebouncedQuery('');
        setActiveIndex(-1);
        inputRef.current?.focus();
    };

    const showDropdown = isFocused && debouncedQuery.trim().length > 0;

    return (
        <div className="search-bar-container">
            {/* Input row */}
            <div className="relative">
                {/* Search icon */}
                <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                </svg>

                <input
                    ref={inputRef}
                    id="search-bar-input"
                    type="text"
                    placeholder="Search buildings (e.g. WALC, Lawson)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        // Delay to allow click on result to fire first
                        setTimeout(() => setIsFocused(false), 200);
                    }}
                    onKeyDown={handleKeyDown}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={showDropdown}
                    aria-controls="search-results-list"
                    aria-activedescendant={
                        activeIndex >= 0 ? `search-result-${sortedResults[activeIndex]?._id}` : undefined
                    }
                    className="w-full pl-10 pr-9 py-2.5 bg-[var(--color-surface)] border border-white/10 rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]/40 transition-colors"
                />

                {/* Clear button */}
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                        aria-label="Clear search"
                        tabIndex={-1}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Results dropdown */}
            {showDropdown && (
                <div
                    id="search-results-list"
                    ref={resultsRef}
                    className="search-results-dropdown"
                    role="listbox"
                >
                    {sortedResults.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                No buildings found matching "<span className="text-[var(--color-purdue-gold)]">{debouncedQuery}</span>"
                            </p>
                        </div>
                    ) : (
                        sortedResults.map((building, index) => (
                            <button
                                key={building._id}
                                id={`search-result-${building._id}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                onClick={() => handleSelect(building)}
                                className={`search-result-item ${index === activeIndex ? 'search-result-active' : ''}`}
                            >
                                <div className="w-9 h-9 rounded-lg bg-[var(--color-purdue-gold)]/10 flex items-center justify-center shrink-0">
                                    <span className="text-[10px] font-bold text-[var(--color-purdue-gold)]">
                                        <HighlightMatch text={building.abbreviation} query={debouncedQuery} />
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">
                                        <HighlightMatch text={building.name} query={debouncedQuery} />
                                    </p>
                                    <p className="text-xs text-[var(--color-text-secondary)] truncate">
                                        {(building.amenities || []).slice(0, 3).join(' · ')}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}