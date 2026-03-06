import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken } from '../lib/auth';

export default function EventsList() {
  const navigate = useNavigate();
  const token = getToken();
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;

    axios.get('/api/events', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => setEvents(res.data || []))
      .catch((err) => {
        console.error('Failed to fetch events:', err);
        setError(err.response?.data?.error || 'Failed to load events.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;

    return events.filter((event) => {
      const title = String(event.title || '').toLowerCase();
      const description = String(event.description || '').toLowerCase();
      const location = String(event.location || '').toLowerCase();
      const clubName = String(event.club?.name || '').toLowerCase();
      const date = String(event.date || '').toLowerCase();
      const time = String(event.time || '').toLowerCase();

      return (
        title.includes(q) ||
        description.includes(q) ||
        location.includes(q) ||
        clubName.includes(q) ||
        date.includes(q) ||
        time.includes(q)
      );
    });
  }, [events, query]);

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/clubs')} className="profile-button-like">Clubs</button>
        <button onClick={() => navigate('/announcements')} className="profile-button-like">Announcements</button>
      </div>

      <div className="w-full max-w-[1500px] mx-auto flex flex-col gap-7 pt-14 sm:pt-16">
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-widest uppercase text-[var(--color-purdue-gold)]">Directory</p>
          <h1 className="text-3xl font-bold">Events</h1>
          {!loading && !error && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events by title, club, location, date..."
            className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-white/10 rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]/40 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-4">
          {loading && <p className="text-sm text-[var(--color-text-secondary)]">Loading events...</p>}
          {!token && <p className="text-sm text-red-300">You must be logged in to view events.</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}

          {!loading && token && !error && filteredEvents.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">No events found.</p>
          )}

          {!loading && token && !error && filteredEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => event.clubId && navigate(`/clubs/${event.clubId}`)}
              className="text-left rounded-xl bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-hover)] transition-colors p-6"
            >
              <div className="flex flex-col gap-1 mb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-purdue-gold)]">
                    {event.club?.name || 'Unknown club'}
                  </p>
                  <h2 className="text-lg font-semibold leading-tight">{event.title}</h2>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {event.date ? new Date(event.date).toLocaleDateString() : ''}
                </span>
              </div>

              {event.description && (
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">{event.description}</p>
              )}

              <div className="text-xs text-[var(--color-text-secondary)]/90 flex items-center justify-between">
                <span>
                  {event.time ? `${event.time} · ` : ''}
                  {event.location || 'No location'}
                </span>
                <span className="text-[var(--color-purdue-gold)]">Open club profile -&gt;</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
