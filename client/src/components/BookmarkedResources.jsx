import { useEffect, useState } from 'react';
import axios from 'axios';

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '';
  }
}

export default function BookmarkedResources() {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get('/api/users/bookmarks/ai');
        if (!cancelled) setBookmarks(res.data || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error || 'Failed to load bookmarks');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpanded = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded(id);
    }
  };

  const handleRemove = async (id) => {
    setRemovingId(id);
    setRemoveError(null);
    try {
      await axios.delete(`/api/users/bookmarks/ai/${id}`);
      setBookmarks((prev) => prev.filter((b) => b._id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      setRemoveError(err.response?.data?.error || 'Failed to remove bookmark');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Bookmarked AI Responses</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Questions you saved from the AI course assistant. Click a card to view the full response.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading your bookmarks...</p>
        )}

        {error && !loading && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && bookmarks.length === 0 && (
          <div className="p-8 text-center bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl">
            <p className="text-sm text-[var(--color-text-secondary)]">
              You haven't bookmarked any AI responses yet.
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-2">
              Open a course, ask the AI a question, and click the bookmark icon on the answer to save it here.
            </p>
          </div>
        )}

        {!loading && !error && bookmarks.length > 0 && (
          <>
            {removeError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {removeError}
              </div>
            )}

            <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-3">
              {bookmarks.map((b) => {
                const expanded = expandedId === b._id;
                return (
                  <div
                    key={b._id}
                    className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden"
                  >
                    <div className="flex items-start gap-2 p-4">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleExpanded(b._id)}
                        onKeyDown={(e) => handleKeyDown(e, b._id)}
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Collapse bookmark' : 'Expand bookmark to see full answer'}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-purdue-gold)] mb-1">
                          Question
                        </p>
                        <p
                          className={`text-sm text-[var(--color-text-primary)] ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}
                        >
                          {b.promptString}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-2">
                          {formatDate(b.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(b._id)}
                        disabled={removingId === b._id}
                        aria-label="Remove bookmark"
                        title="Remove bookmark"
                        className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-[var(--color-surface)] transition-colors disabled:opacity-50"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                      </button>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-purdue-gold)] mb-2 mt-2">
                          Answer
                        </p>
                        <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                          {b.aiResponseText}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
