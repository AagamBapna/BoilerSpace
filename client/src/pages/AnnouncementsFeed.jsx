import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken } from '../lib/auth';

export default function AnnouncementsFeed() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('You must be logged in to view announcements.');
      setLoading(false);
      return;
    }

    axios.get('/api/announcements', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => setAnnouncements(res.data || []))
      .catch((err) => {
        console.error('Failed to fetch announcements:', err);
        setError(err.response?.data?.error || 'Failed to load announcements.')
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/clubs')} className="profile-button-like">Clubs</button>
      </div>

      <div className="w-full max-w-[1500px] mx-auto flex flex-col gap-7 pt-14 sm:pt-16">
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-widest uppercase text-[var(--color-purdue-gold)]">Feed</p>
          <h1 className="text-3xl font-bold">Announcements</h1>
        </div>

        <div className="flex flex-col gap-4">
          {loading && <p className="text-sm text-[var(--color-text-secondary)]">Loading announcements...</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}

          {!loading && !error && announcements.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">No announcements yet.</p>
          )}

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
  );
}
