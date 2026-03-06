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
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 pr-4 pl-8 sm:pr-6 sm:pl-12 md:pr-8 md:pl-16 lg:pr-10 lg:pl-20 xl:pr-12 xl:pl-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/clubs')} className="profile-button-like">Clubs</button>
      </div>

      <div className="w-full max-w-[1500px] mx-auto flex flex-col gap-7">
        <div className="rounded-2xl bg-[var(--color-surface-light)] p-7 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center shrink-0">
                <span className="text-black text-lg font-bold">B</span>
              </div>
              <div>
                <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-purdue-gold)]">Feed</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Announcements</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7 ml-8 sm:ml-12 md:ml-16 lg:ml-20">
          {loading && <p className="text-sm text-[var(--color-text-secondary)]">Loading announcements...</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}

          {!loading && !error && announcements.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">No announcements yet.</p>
          )}

          <div className="grid grid-cols-1 gap-4">
            {announcements.map((a) => (
              <button
                key={a.id}
                onClick={() => a.clubId && navigate(`/clubs/${a.clubId}`)}
                className="text-left rounded-xl bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-hover)] transition-colors p-6"
              >
                <div className="flex flex-col gap-1 mb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
                  <span className="text-[var(--color-purdue-gold)]">Open club profile -&gt;</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
