import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function ClubProfile({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [club, setClub] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice || null);

  useEffect(() => {
    axios.get(`/api/clubs/${id}`)
      .then(res => setClub(res.data))
      .catch(err => {
        if (err.response?.status === 404) setError('Club not found.');
        else setError('Failed to load club.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setEventsLoading(true);
    axios.get(`/api/events?clubId=${id}`)
      .then(res => setEvents(res.data || []))
      .catch(err => {
        console.error('Failed to load events:', err);
        setEvents([]);
      })
      .finally(() => setEventsLoading(false));
  }, [id]);

  const isOrganizer = Boolean(
    user?.id && Array.isArray(club?.organizerIds) && club.organizerIds.map(String).includes(String(user.id))
  );

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/clubs')} className="profile-button-like">Clubs</button>
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/announcements')} className="profile-button-like">Announcements</button>
        {isOrganizer && (
          <button onClick={() => navigate(`/clubs/${id}/dashboard`)} className="profile-button-like profile-button-gold">Organizer Dashboard</button>
        )}
      </div>

      <div className="w-full max-w-[1500px] mx-auto flex flex-col gap-7 pt-14 sm:pt-16">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl bg-[var(--color-surface-light)] ml-8 sm:ml-12 md:ml-16 lg:ml-20">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading club...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl bg-[var(--color-surface-light)] ml-8 sm:ml-12 md:ml-16 lg:ml-20">
            <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
            <button
              onClick={() => navigate('/clubs')}
              className="text-xs text-[var(--color-purdue-gold)] hover:underline"
            >
              Back to clubs
            </button>
          </div>
        )}

        {!loading && !error && club && (
          <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">

            {notice && (
              <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
                {notice}
              </div>
            )}

            {/* Category + Name */}
            <div>
              {club.category && (
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-purdue-gold)] mb-2">
                {club.category}
              </p>
              )}
              <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">
                {club.name}
              </h1>
            </div>

            <div className="h-px bg-white/5" />

            {/* Description */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/20 mb-2">About</p>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {club.description || 'No description available.'}
              </p>
            </div>

            <div className="h-px bg-white/5" />

            {/* Meta */}
            <div className="flex flex-col gap-4">
              {club.contactInfo && (
                <div className="flex gap-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/20 w-20 shrink-0 pt-px">Contact</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{club.contactInfo}</span>
                </div>
              )}
              {club.createdAt && (
                <div className="flex gap-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/20 w-20 shrink-0 pt-px">Added</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {new Date(club.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

            <div className="h-px bg-white/5" />

            {/* Events */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/20 mb-4">Events</p>
              {eventsLoading && (
                <p className="text-sm text-[var(--color-text-secondary)]">Loading events...</p>
              )}
              {!eventsLoading && events.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">No events yet.</p>
              )}
              {!eventsLoading && events.length > 0 && (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface)] transition-colors p-4 border border-white/10">
                      <div className="flex flex-col gap-1">
                        <h3 className="font-semibold text-[var(--color-text-primary)]">{event.title}</h3>
                        {event.description && (
                          <p className="text-xs text-[var(--color-text-secondary)]">{event.description}</p>
                        )}
                        <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)] mt-2">
                          {event.date && (
                            <span>📅 {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          )}
                          {event.time && <span>⏰ {event.time}</span>}
                          {event.location && <span>📍 {event.location}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}