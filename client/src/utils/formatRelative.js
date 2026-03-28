/**
 * Format date string as relative timestamp
 * Returns N/A for null/undefined/invalid values
 */
export function formatRelative(dateStr) {
    if (!dateStr) return 'N/A';

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';

    const now = Date.now();
    const diffMs = now - date.getTime();

    if (diffMs < 0) return 'just now';

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return 'just now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

/**
 * Format date string as absolute timestamp for tooltips
 * Returns N/A for null/undefined/invalid values
 */
export function formatAbsolute(dateStr) {
    if (!dateStr) return 'N/A';

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';

    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
    });
}
