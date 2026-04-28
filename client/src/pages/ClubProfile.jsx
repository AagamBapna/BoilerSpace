import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import ClubCalendar from '../components/ClubCalendar';

const DAY_OF_WEEK_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

function getDayOfWeekValue(dateValue) {
  const normalized = String(dateValue || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';
  const date = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : String(date.getDay());
}

export default function ClubProfile({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const viewerId = String(user?.id || user?._id || '');
  const [club, setClub] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice || null);
  const [actionError, setActionError] = useState(null);
  const [isMember, setIsMember] = useState(false);
  const [isPendingRequest, setIsPendingRequest] = useState(false);
  const [isRemovedFromClub, setIsRemovedFromClub] = useState(false);
  const [clubAccessRole, setClubAccessRole] = useState(null);
  const [joining, setJoining] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [createEventError, setCreateEventError] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    recurrenceType: 'none',
    recurrenceEndDate: '',
    recurrenceDayOfWeek: '',
  });

  const loadEvents = useCallback(async () => {
    if (!id) return;
    setEventsLoading(true);
    try {
      const res = await axios.get(`/api/events?clubId=${id}`);
      setEvents(res.data || []);
    } catch (err) {
      console.error('Failed to load events:', err);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [id]);

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
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!viewerId || !id) {
      setIsMember(false);
      setClubAccessRole(null);
      return;
    }

    axios.get(`/api/users/${viewerId}`)
      .then((res) => {
        const joined = Array.isArray(res.data?.clubIds) ? res.data.clubIds.map(String) : [];
        const pending = Array.isArray(res.data?.pendingClubIds) ? res.data.pendingClubIds.map(String) : [];
        const removed = Array.isArray(res.data?.removedClubIds) ? res.data.removedClubIds.map(String) : [];
        setIsMember(joined.includes(String(id)));
        setIsPendingRequest(pending.includes(String(id)));
        setIsRemovedFromClub(removed.includes(String(id)));
      })
      .catch(() => {
        setIsMember(false);
        setIsPendingRequest(false);
        setIsRemovedFromClub(false);
      });

    axios.get(`/api/clubs/${id}/access`)
      .then((res) => {
        setClubAccessRole(res.data?.role || null);
      })
      .catch(() => {
        setClubAccessRole(null);
      });
  }, [viewerId, id]);

  const isOrganizer = Boolean(
    viewerId && Array.isArray(club?.organizerIds) && club.organizerIds.map(String).includes(viewerId)
  );

  const topActionClass = 'profile-button-like min-w-[120px] justify-center';
  const topActionGoldClass = `${topActionClass} profile-button-gold`;

  const canCreateEvent = Boolean(isOrganizer && club && viewerId);
  const canViewDashboard = Boolean(viewerId && (isOrganizer || clubAccessRole === 'officer' || clubAccessRole === 'admin'));
  const canJoin = Boolean(viewerId && !isOrganizer && !isMember && !isPendingRequest && club);
  const canLeave = Boolean(viewerId && !isOrganizer && isMember && club);
  const clubCalendarEvents = useMemo(() => events, [events]);
  const listedEvents = useMemo(() => {
    const toTimestamp = (event) => {
      const dateKey = String(event?.date || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return Number.POSITIVE_INFINITY;
      const [year, month, day] = dateKey.split('-').map(Number);
      const timeKey = /^\d{2}:\d{2}$/.test(String(event?.time || '')) ? String(event.time) : '12:00';
      const [hours, minutes] = timeKey.split(':').map(Number);
      return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
    };

    const now = Date.now();
    const recurringByGroup = new Map();
    const singles = [];

    for (const event of events) {
      const recurringType = event?.recurrence?.type;
      const groupId = event?.recurrence?.recurrenceGroupId;
      const isSeriesEvent = recurringType && recurringType !== 'none' && groupId;

      if (!isSeriesEvent) {
        singles.push({ ...event, _isRecurringListItem: false });
        continue;
      }

      if (!recurringByGroup.has(groupId)) recurringByGroup.set(groupId, []);
      recurringByGroup.get(groupId).push(event);
    }

    const recurringRepresentatives = [];
    recurringByGroup.forEach((seriesEvents) => {
      const sorted = [...seriesEvents].sort((a, b) => toTimestamp(a) - toTimestamp(b));
      const upcoming = sorted.find((event) => toTimestamp(event) >= now);
      const representative = upcoming || sorted[sorted.length - 1];
      if (representative) {
        recurringRepresentatives.push({ ...representative, _isRecurringListItem: true });
      }
    });

    return [...singles, ...recurringRepresentatives].sort((a, b) => toTimestamp(a) - toTimestamp(b));
  }, [events]);

  const handleJoinClub = async () => {
    if (!id || !viewerId) return;
    setNotice(null);
    setActionError(null);
    try {
      setJoining(true);
      await axios.post(`/api/clubs/${id}/join`);
      setIsPendingRequest(true);
      if (isRemovedFromClub) {
        setIsRemovedFromClub(false);
        setNotice('Your rejoin request has been sent.');
      } else {
        setNotice('Your join request has been sent.');
      }
    } catch (err) {
      setActionError(err.response?.data?.message || err.response?.data?.error || 'Failed to join club.');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!id || !viewerId) return;
    const confirmed = window.confirm('Leave this club?');
    if (!confirmed) return;
    setNotice(null);
    setActionError(null);
    try {
      setJoining(true);
      await axios.post(`/api/clubs/${id}/leave`);
      setIsMember(false);
      setIsPendingRequest(false);
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
    setCreateEventError(null);
    if (!isOrganizer) {
      setActionError('You do not have permission to create events for this club.');
      return;
    }
    setShowCreateEventModal(true);
  };

  const handleCreateEvent = async () => {
    const recurrenceDayOfWeek = newEvent.recurrenceType === 'weekly'
      ? String(newEvent.recurrenceDayOfWeek || getDayOfWeekValue(newEvent.date) || '')
      : null;
    const recurrencePayload = {
      type: newEvent.recurrenceType,
      endDate: String(newEvent.recurrenceEndDate || '').trim(),
    };

    if (newEvent.recurrenceType === 'weekly') {
      recurrencePayload.dayOfWeek = recurrenceDayOfWeek;
    }

    const payload = {
      title: String(newEvent.title || '').trim(),
      description: String(newEvent.description || '').trim(),
      date: String(newEvent.date || '').trim(),
      time: String(newEvent.time || '').trim(),
      location: String(newEvent.location || '').trim(),
      clubId: id,
      recurrence: newEvent.recurrenceType === 'none' ? { type: 'none' } : recurrencePayload,
    };

    if (!payload.title || !payload.description || !payload.date || !payload.time || !payload.location) {
      setCreateEventError('All event fields are required.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      setCreateEventError('Date must be in YYYY-MM-DD format.');
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(payload.time)) {
      setCreateEventError('Time must be in HH:mm format.');
      return;
    }

    if (payload.recurrence.type !== 'none' && !payload.recurrence.endDate) {
      setCreateEventError('Recurring events require an end date.');
      return;
    }

    if (payload.recurrence.type === 'weekly' && !payload.recurrence.dayOfWeek && payload.recurrence.dayOfWeek !== '0') {
      setCreateEventError('Recurring events require a day of week.');
      return;
    }

    try {
      setCreatingEvent(true);
      setNotice(null);
      setActionError(null);
      setCreateEventError(null);
      await axios.post('/api/events', payload);
      await loadEvents();
      setNewEvent({
        title: '',
        description: '',
        date: '',
        time: '',
        location: '',
        recurrenceType: 'none',
        recurrenceEndDate: '',
        recurrenceDayOfWeek: '',
      });
      setShowCreateEventModal(false);
      setNotice('Event created successfully.');
    } catch (err) {
      const fieldMessage = err.response?.data?.fields
        ? Object.values(err.response.data.fields).find(Boolean)
        : null;
      setCreateEventError(fieldMessage || err.response?.data?.message || err.response?.data?.error || 'Failed to create event.');
    } finally {
      setCreatingEvent(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 pb-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/clubs')} className={topActionClass}>Clubs</button>
        <button onClick={() => navigate('/')} className={topActionClass}>Map</button>
        <button onClick={() => navigate('/activity')} className={topActionClass}>Activity</button>
        {canCreateEvent && (
          <button type="button" onClick={handleCreateEventClick} className={topActionGoldClass}>Create Event</button>
        )}
        {canJoin && (
          <button onClick={handleJoinClub} disabled={joining} className={topActionGoldClass}>
            {joining ? 'Sending...' : isRemovedFromClub ? 'Request to Rejoin' : 'Request to Join'}
          </button>
        )}
        {!canJoin && isPendingRequest && !isMember && (
          <button disabled className="profile-button-like profile-button-gold min-w-[120px] justify-center opacity-70 cursor-not-allowed">
            Request Sent
          </button>
        )}
        {canLeave && (
          <button onClick={handleLeaveClub} disabled={joining} className="profile-button-like profile-button-danger min-w-[120px] justify-center">
            {joining ? 'Leaving...' : 'Leave Club'}
          </button>
        )}
        {canViewDashboard && (
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
          <div className="flex flex-col gap-6 w-full" style={{ maxWidth: '72rem', marginLeft: '2rem', paddingTop: '2rem' }}>

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

            <ClubCalendar
              events={clubCalendarEvents}
              monthDate={calendarMonth}
              onMonthChange={setCalendarMonth}
              onEventClick={(event) => navigate(`/events/${event.id}`)}
              loading={eventsLoading}
            />

            <div className="h-px bg-white/5" />

            {/* Events */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/20 mb-4">Events</p>
              {eventsLoading && (
                <p className="text-sm text-[var(--color-text-secondary)]">Loading events...</p>
              )}
              {!eventsLoading && listedEvents.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">No events yet.</p>
              )}
              {!eventsLoading && listedEvents.length > 0 && (
                <div className="space-y-3">
                  {listedEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="w-full text-left rounded-lg bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface)] transition-colors p-4 border border-white/10"
                    >
                      <div style={{ padding: '0.5rem' }} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[var(--color-text-primary)]">{event.title}</h3>
                          {event._isRecurringListItem && (
                            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--color-purdue-gold)]/20 text-[var(--color-purdue-gold)] border border-[var(--color-purdue-gold)]/30">
                              {`Recurring ${event.date ? `• ${new Date(event.date).toLocaleDateString('en-US', { weekday: 'short' })}` : ''}`}
                            </span>
                          )}
                        </div>
                        {event.description && (
                          <p className="text-xs text-[var(--color-text-secondary)]">{event.description}</p>
                        )}
                        <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)] mt-2">
                          {event.date && (
                            <span>{new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          )}
                          {event.time && <span>{event.time}</span>}
                          {event.location && <span>{event.location}</span>}
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
        <div className="background-blur">
          <div className="course-selector">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Create Event</h2>
              <button
                onClick={() => !creatingEvent && setShowCreateEventModal(false)}
                className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
                disabled={creatingEvent}
              >
                <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6">
              <div className="grid grid-cols-1 gap-3">
                {createEventError && (
                  <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                    {createEventError}
                  </div>
                )}
                <InputField label="Title" value={newEvent.title} onChange={(v) => setNewEvent((p) => ({ ...p, title: v }))} placeholder="Event title" />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Description</label>
                  <textarea
                    rows={4}
                    value={newEvent.description}
                    onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Event description"
                    className="px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Start Date"
                    type="date"
                    value={newEvent.date}
                    onChange={(v) => setNewEvent((p) => ({
                      ...p,
                      date: v,
                      recurrenceDayOfWeek: p.recurrenceType === 'weekly' && !p.recurrenceDayOfWeek ? getDayOfWeekValue(v) : p.recurrenceDayOfWeek,
                    }))}
                    placeholder="YYYY-MM-DD"
                  />
                  <InputField
                    label="Time"
                    type="time"
                    value={newEvent.time}
                    onChange={(v) => setNewEvent((p) => ({ ...p, time: v }))}
                    placeholder="HH:mm"
                  />
                </div>
                <InputField label="Location" value={newEvent.location} onChange={(v) => setNewEvent((p) => ({ ...p, location: v }))} placeholder="Location" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[var(--color-text-secondary)]">Recurrence</label>
                    <select
                      value={newEvent.recurrenceType}
                      onChange={(e) => setNewEvent((p) => ({
                        ...p,
                        recurrenceType: e.target.value,
                        recurrenceDayOfWeek: e.target.value === 'weekly' ? (p.recurrenceDayOfWeek || getDayOfWeekValue(p.date)) : '',
                      }))}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                    >
                      <option value="none">None</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  <InputField
                    label="End Date"
                    type="date"
                    value={newEvent.recurrenceEndDate}
                    onChange={(v) => setNewEvent((p) => ({ ...p, recurrenceEndDate: v }))}
                    placeholder="YYYY-MM-DD"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[var(--color-text-secondary)]">Day of Week</label>
                    <select
                      value={newEvent.recurrenceType === 'weekly' ? (newEvent.recurrenceDayOfWeek || getDayOfWeekValue(newEvent.date)) : ''}
                      onChange={(e) => setNewEvent((p) => ({ ...p, recurrenceDayOfWeek: e.target.value }))}
                      disabled={newEvent.recurrenceType !== 'weekly'}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)] disabled:opacity-60"
                    >
                      <option value="">Select day</option>
                      {DAY_OF_WEEK_OPTIONS.map((day) => (
                        <option key={day.value} value={day.value}>{day.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setShowCreateEventModal(false)} disabled={creatingEvent} className="px-5 py-2.5 text-base text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Cancel</button>
                  <button onClick={handleCreateEvent} disabled={creatingEvent} className="px-5 py-2.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-base hover:opacity-90 disabled:opacity-50">
                    {creatingEvent ? 'Creating...' : 'Create Event'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text', min }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--color-text-secondary)]">{label}</label>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
      />
    </div>
  );
}