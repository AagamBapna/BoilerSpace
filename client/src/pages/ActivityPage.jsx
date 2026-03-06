import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken } from '../lib/auth';

export default function ActivityPage({ initialTab = 'events' }) {
  const navigate = useNavigate();
  const token = getToken();

  const [activeTab, setActiveTab] = useState(initialTab === 'announcements' ? 'announcements' : 'events');
  const [query, setQuery] = useState('');

  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(Boolean(token));
  const [eventsError, setEventsError] = useState(null);
  const [announcementsError, setAnnouncementsError] = useState(null);

  useEffect(() => {
    setActiveTab(initialTab === 'announcements' ? 'announcements' : 'events');
    setQuery('');
  }, [initialTab]);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setEventsError(null);
    setAnnouncementsError(null);

    const headers = { Authorization: `Bearer ${token}` };

    Promise.allSettled([
      axios.get('/api/events', { headers }),
      axios.get('/api/announcements', { headers }),
    ])
      .then(([eventsRes, announcementsRes]) => {
        if (eventsRes.status === 'fulfilled') {
          setEvents(eventsRes.value.data || []);
        } else {
          setEvents([]);
          setEventsError(eventsRes.reason?.response?.data?.error || 'Failed to load events.');
        }

        if (announcementsRes.status === 'fulfilled') {
          setAnnouncements(announcementsRes.value.data || []);
        } else {
          setAnnouncements([]);
          setAnnouncementsError(announcementsRes.reason?.response?.data?.error || 'Failed to load announcements.');
        }
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

      return title.includes(q)
        || description.includes(q)
        || location.includes(q)
        || clubName.includes(q)
        || date.includes(q)
        || time.includes(q);
    });
  }, [events, query]);

  const filteredAnnouncements = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return announcements;

    return announcements.filter((a) => {
      const message = String(a.message || '').toLowerCase();
      const clubName = String(a.club?.name || '').toLowerCase();
      const eventTitle = String(a.event?.title || '').toLowerCase();
      const author = String(a.author?.displayName || a.author?.email || '').toLowerCase();

      return message.includes(q)
        || clubName.includes(q)
        || eventTitle.includes(q)
        || author.includes(q);
    });
  }, [announcements, query]);

  const handleSwitchTab = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setQuery('');
    navigate(tab === 'events' ? '/events' : '/announcements');
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/clubs')} className="profile-button-like">Clubs</button>
      </div>

      <div className="w-full max-w-[1400px] mr-auto ml-6 sm:ml-10 md:ml-14 lg:ml-20 xl:ml-24 flex flex-col gap-7 pt-14 sm:pt-16">
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-widest uppercase text-[var(--color-purdue-gold)]">Activity</p>
          <h1 className="text-3xl font-bold">Campus Activity</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSwitchTab('events')}
            className={`profile-button-like ${activeTab === 'events' ? 'profile-button-gold' : ''}`}
          >
            Events
          </button>
          <button
            onClick={() => handleSwitchTab('announcements')}
            className={`profile-button-like ${activeTab === 'announcements' ? 'profile-button-gold' : ''}`}
          >
            Announcements
          </button>
        </div>

        <div className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeTab === 'events' ? 'Search events by title, club, location, date...' : 'Search announcements by message, club, event, author...'}
            className="w-full px-4 py-2.5 bg-[var(--color-surface)] border border-white/10 rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]/40 transition-colors"
          />
        </div>

        {!token && <p className="text-sm text-red-300">You must be logged in to view activity.</p>}
        {loading && <p className="text-sm text-[var(--color-text-secondary)]">Loading activity...</p>}

        {!loading && token && activeTab === 'events' && eventsError && (
          <p className="text-sm text-red-300">{eventsError}</p>
        )}
        {!loading && token && activeTab === 'announcements' && announcementsError && (
          <p className="text-sm text-red-300">{announcementsError}</p>
        )}

        {!loading && token && activeTab === 'events' && !eventsError && (
          <div className="flex flex-col gap-4">
            {filteredEvents.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)]">No events found.</p>
            )}

            {filteredEvents.map((event) => (
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
        )}

        {!loading && token && activeTab === 'announcements' && !announcementsError && (
          <div className="flex flex-col gap-4">
            {filteredAnnouncements.length === 0 && (
              <p className="text-sm text-[var(--color-text-secondary)]">No announcements found.</p>
            )}

            {filteredAnnouncements.map((a) => (
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
                    <h2 className="text-lg font-semibold leading-tight">{a.event?.title || 'Club update'}</h2>
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
        )}
      </div>
    </div>
  );
}
