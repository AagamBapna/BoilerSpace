import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { getToken } from '../lib/auth';

export default function EventPage({ user }) {
  const { id: eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showCreateAnnouncementModal, setShowCreateAnnouncementModal] = useState(false);

  const token = getToken();
  const topActionClass = 'profile-button-like min-w-[110px] justify-center';

  const headers = useMemo(() => (
    token ? { Authorization: `Bearer ${token}` } : undefined
  ), [token]);

  const isOrganizer = useMemo(() => {
    const userId = String(user?.id || user?._id || '');
    const organizerIds = Array.isArray(event?.club?.organizerIds) ? event.club.organizerIds : [];
    return organizerIds.some((o) => String(o?._id || o?.id || o) === userId);
  }, [event, user?.id, user?._id]);

  const loadData = useCallback(async () => {
    if (!headers) {
      setError('You must be logged in to view this event.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [eventRes, annRes] = await Promise.allSettled([
      axios.get(`/api/events/${eventId}`, { headers }),
      axios.get(`/api/events/${eventId}/announcements`, { headers }),
    ]);

    if (eventRes.status === 'fulfilled') {
      setEvent(eventRes.value.data || null);
    } else {
      const msg = eventRes.reason?.response?.data?.error || 'Failed to load event.';
      setError(msg);
      setEvent(null);
    }

    if (annRes.status === 'fulfilled') {
      const list = Array.isArray(annRes.value.data) ? annRes.value.data : [];
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      setAnnouncements(list);
    } else {
      setAnnouncements([]);
      if (!eventRes || eventRes.status !== 'rejected') {
        const msg = annRes.reason?.response?.data?.error || 'Failed to load announcements.';
        setError(msg);
      }
    }

    setLoading(false);
  }, [eventId, headers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePostAnnouncement = async () => {
    setNotice(null);
    setError(null);

    if (!message.trim()) {
      setError('Announcement message is required.');
      return false;
    }

    if (!headers) {
      setError('You must be logged in to post announcements.');
      return false;
    }

    try {
      setSubmitting(true);
      await axios.post(
        `/api/events/${eventId}/announcements`,
        { message: message.trim() },
        { headers },
      );
      setMessage('');
      setNotice('Announcement posted.');
      await loadData();
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Failed to post announcement.';
      setError(msg);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAnnouncementClick = () => {
    setNotice(null);
    setError(null);
    if (!isOrganizer) {
      setError('You do not have permission to post announcements for this event.');
      return;
    }
    setShowCreateAnnouncementModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24">
        <div className="w-full max-w-[1200px] mx-auto pt-16">
          <p className="text-sm text-[var(--color-text-secondary)]">Loading event...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 sm:px-12 md:px-16 lg:px-20 xl:px-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/activity')} className={topActionClass}>Activity</button>
        <button onClick={() => navigate('/clubs')} className={topActionClass}>Clubs</button>
        {event?.clubId && (
          <button onClick={() => navigate(`/clubs/${event.clubId}`)} className={topActionClass}>Back to Club</button>
        )}
        <button onClick={handleCreateAnnouncementClick} className="profile-button-like profile-button-gold min-w-[130px] justify-center">Create Announcement</button>
      </div>

      <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-6 pt-14 sm:pt-16">
        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {notice && (
          <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
            {notice}
          </div>
        )}

        {event && (
          <section className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7">
            <p className="text-xs tracking-widest uppercase text-[var(--color-purdue-gold)] mb-2">
              {event.club?.name || 'Event'}
            </p>
            <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
            {event.description && (
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">{event.description}</p>
            )}
            <div className="text-xs text-[var(--color-text-secondary)] flex flex-wrap gap-x-4 gap-y-1">
              {event.date && <span>Date: {new Date(event.date).toLocaleDateString()}</span>}
              {event.time && <span>Time: {event.time}</span>}
              {event.location && <span>Location: {event.location}</span>}
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7">
          <h2 className="text-lg font-semibold mb-3">Announcements</h2>
          {announcements.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No announcements yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {announcements.map((a) => (
                <article key={a.id} className="rounded-xl border border-white/10 bg-[var(--color-surface)] p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {a.author?.displayName || a.author?.email || 'Organizer'}
                    </p>
                    <time className="text-xs text-[var(--color-text-secondary)]">
                      {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                    </time>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{a.message}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {showCreateAnnouncementModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--color-surface-light)] p-7 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Create Announcement</h2>
              <button
                onClick={() => !submitting && setShowCreateAnnouncementModal(false)}
                className="profile-button-like"
                disabled={submitting}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Announcement message"
                className="px-3 py-2 rounded-xl bg-[var(--color-surface)] border border-white/10 text-sm"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowCreateAnnouncementModal(false)} disabled={submitting} className="profile-button-like">Cancel</button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await handlePostAnnouncement();
                    if (ok) setShowCreateAnnouncementModal(false);
                  }}
                  disabled={submitting}
                  className="px-4 py-2 bg-[var(--color-purdue-gold)] text-black rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  {submitting ? 'Posting...' : 'Post Announcement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
