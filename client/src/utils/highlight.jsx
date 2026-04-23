function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlight(text, query, className = 'bg-[#CEB888] text-black rounded px-0.5') {
    if (!text || !query) return text;
    const trimmed = query.trim();
    if (!trimmed) return text;

    const pattern = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig');
    const parts = String(text).split(pattern);

    return parts.map((part, i) => {
        if (i % 2 === 1) {
            return (
                <mark key={i} className={className}>
                    {part}
                </mark>
            );
        }
        return <span key={i}>{part}</span>;
    });
}
