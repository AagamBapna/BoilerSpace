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
  const [actionError, setActionError] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
  });

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

  useEffect(() => {
    if (!user?.id || !id) {
      setIsMember(false);
      return;
    }

    axios.get(`/api/users/${user.id}`)
      .then((res) => {
        const joined = Array.isArray(res.data?.clubIds) ? res.data.clubIds.map(String) : [];
        setIsMember(joined.includes(String(id)));
      })
      .catch(() => {
        setIsMember(false);
      });
  }, [user?.id, id]);

  const isOrganizer = Boolean(
    user?.id && Array.isArray(club?.organizerIds) && club.organizerIds.map(String).includes(String(user.id))
  );

  const topActionClass = 'profile-button-like min-w-[120px] justify-center';
  const topActionGoldClass = `${topActionClass} profile-button-gold`;

  const canJoin = Boolean(user?.id && !isOrganizer && !isMember && club);
  const canLeave = Boolean(user?.id && !isOrganizer && isMember && club);

  const handleJoinClub = async () => {
    if (!id || !user?.id) return;
    setNotice(null);
    setActionError(null);
    try {
      setJoining(true);
      await axios.post(`/api/clubs/${id}/join`);
      setIsMember(true);
      setNotice('You joined this club.');
    } catch (err) {
      setActionError(err.response?.data?.message || err.response?.data?.error || 'Failed to join club.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!id || !user?.id) return;
    const confirmed = window.confirm('Leave this club?');
    if (!confirmed) return;
    setNotice(null);
    setActionError(null);
    try {
      setJoining(true);
      await axios.post(`/api/clubs/${id}/leave`);
      setIsMember(false);
      setNotice('You left this club.');
    } catch (err) {
      setActionError(err.response?.data?.message || err.response?.data?.error || 'Failed to leave club.');
    } finally {
      setJoining(false);
    }
  };

  const handleCreateEventClick = () => {
    setNotice(null);
    setActionError(null);
    if (!isOrganizer) {
      setActionError('You do not have permission to create events for this club.');
      return;
    }
    setShowCreateEventModal(true);
  };

  const handleCreateEvent = async () => {
    const payload = {
      title: String(newEvent.title || '').trim(),
      description: String(newEvent.description || '').trim(),
      date: String(newEvent.date || '').trim(),
      time: String(newEvent.time || '').trim(),
      location: String(newEvent.location || '').trim(),
      clubId: id,
    };

    if (!payload.title || !payload.description || !payload.date || !payload.time || !payload.location) {
      setActionError('All event fields are required.');
      return;
    }

    try {
      setCreatingEvent(true);
      setNotice(null);
      setActionError(null);
      const res = await axios.post('/api/events', payload);
      setEvents((prev) => [...prev, res.data]);
      setNewEvent({ title: '', description: '', date: '', time: '', location: '' });
      setShowCreateEventModal(false);
      setNotice('Event created successfully.');
    } catch (err) {
      setActionError(err.response?.data?.message || err.response?.data?.error || 'Failed to create event.');
    } finally {
      setCreatingEvent(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/clubs')} className={topActionClass}>Clubs</button>
        <button onClick={() => navigate('/')} className={topActionClass}>Map</button>
        <button onClick={() => navigate('/activity')} className={topActionClass}>Activity</button>
        <button onClick={handleCreateEventClick} className={topActionGoldClass}>Create Event</button>
        {canJoin && (
          <button onClick={handleJoinClub} disabled={joining} className={topActionGoldClass}>
            {joining ? 'Joining...' : 'Join Club'}
          </button>
        )}
        {canLeave && (
          <button onClick={handleLeaveClub} disabled={joining} className="profile-button-like profile-button-danger min-w-[120px] justify-center">
            {joining ? 'Leaving...' : 'Leave Club'}
          </button>
        )}
        {isOrganizer && (
          <button onClick={() => navigate(`/clubs/${id}/dashboard`)} className={topActionGoldClass}>Organizer Dashboard</button>
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

            {actionError && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                {actionError}
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
                    <button
                      key={event.id}
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="w-full text-left rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface)] transition-colors p-4 border border-white/10"
                    >
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
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {showCreateEventModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--color-surface-light)] p-7 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Create Event</h2>
              <button
                onClick={() => !creatingEvent && setShowCreateEventModal(false)}
                className="profile-button-like"
                disabled={creatingEvent}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <InputField label="Title" value={newEvent.title} onChange={(v) => setNewEvent((p) => ({ ...p, title: v }))} placeholder="Event title" />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-secondary)]">Description</label>
                <textarea
                  rows={4}
                  value={newEvent.description}
                  onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Event description"
                  className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField label="Date" value={newEvent.date} onChange={(v) => setNewEvent((p) => ({ ...p, date: v }))} placeholder="YYYY-MM-DD" />
                <InputField label="Time" value={newEvent.time} onChange={(v) => setNewEvent((p) => ({ ...p, time: v }))} placeholder="HH:mm" />
              </div>
              <InputField label="Location" value={newEvent.location} onChange={(v) => setNewEvent((p) => ({ ...p, location: v }))} placeholder="Location" />
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreateEventModal(false)} disabled={creatingEvent} className="profile-button-like">Cancel</button>
                <button onClick={handleCreateEvent} disabled={creatingEvent} className="px-4 py-2 bg-[var(--color-purdue-gold)] text-black rounded text-sm font-semibold disabled:opacity-60">
                  {creatingEvent ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--color-text-secondary)]">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
      />
    </div>
  );
}