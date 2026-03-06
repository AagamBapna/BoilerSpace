import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function AnnouncementsFeed() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get('/api/announcements')
      .then((res) => setAnnouncements(res.data || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load announcements.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen w-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] px-8 py-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-widest uppercase text-[var(--color-purdue-gold)]">Feed</p>
            <h1 className="text-3xl font-bold">Announcements</h1>
          </div>
          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
              onClick={() => navigate('/')}
            >
              Map
            </button>
            <button
              className="px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-sm"
              onClick={() => navigate('/clubs')}
            >
              Clubs
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-[var(--color-text-secondary)]">Loading announcements...</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}

        {!loading && !error && announcements.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)]">No announcements yet.</p>
        )}

        <div className="grid grid-cols-1 gap-3">
          {announcements.map((a) => (
            <button
              key={a.id}
              onClick={() => a.clubId && navigate(`/clubs/${a.clubId}`)}
              className="text-left rounded-xl border border-white/10 bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-hover)] transition-colors p-4"
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[var(--color-purdue-gold)]">
                    {a.club?.name || 'Unknown club'}
                  </p>
                  <h2 className="text-lg font-semibold leading-tight">{a.event?.title || 'Event update'}</h2>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                </span>
              </div>

              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">{a.message}</p>

              <div className="text-xs text-[var(--color-text-secondary)]/80 flex items-center justify-between">
                <span>By {a.author?.displayName || a.author?.email || 'Organizer'}</span>
                <span className="text-[var(--color-purdue-gold)]">Open club profile -></span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
