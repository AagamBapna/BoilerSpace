import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

export default function ClubOrganizerDashboard({ user }) {
  const { id: clubId } = useParams();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const [newOrganizerId, setNewOrganizerId] = useState('');
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
  });
  const [announcement, setAnnouncement] = useState({
    eventId: '',
    message: '',
  });

  const isOrganizer = useMemo(() => {
    const viewerId = String(user?.id || user?._id || '');
    return Boolean(viewerId && Array.isArray(club?.organizerIds) && club.organizerIds.map(String).includes(viewerId));
  }, [club, user]);

  const loadMembers = async () => {
    try {
      setMembersLoading(true);
      const membersRes = await axios.get(`/api/clubs/${clubId}/members`);
      setMembers(membersRes.data || []);
    } catch (err) {
      setMembers([]);
      setError(err.response?.data?.message || 'Failed to load members.');
    } finally {
      setMembersLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const clubRes = await axios.get(`/api/clubs/${clubId}`);
      setClub(clubRes.data);

      const organizerIds = Array.isArray(clubRes.data?.organizerIds) ? clubRes.data.organizerIds.map(String) : [];
      const viewerId = String(user?.id || user?._id || '');
      const viewerIsOrganizer = Boolean(viewerId && organizerIds.includes(viewerId));

      if (!viewerIsOrganizer) {
        setEvents([]);
        setMembers([]);
        return;
      }

      try {
        const eventsRes = await axios.get(`/api/events?clubId=${clubId}`);
        const loadedEvents = eventsRes.data || [];
        setEvents(loadedEvents);
        if (!announcement.eventId && loadedEvents.length) {
          setAnnouncement((prev) => ({ ...prev, eventId: loadedEvents[0].id }));
        }
      } catch (err) {
        setEvents([]);
        setError(err.response?.data?.error || 'Failed to load club events.');
      }

      await loadMembers();
    } catch (err) {
      setClub(null);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load organizer dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clubId, user?.id]);

  const handleAddOrganizer = async () => {
    try {
      setNotice(null);
      const normalizedUserId = String(newOrganizerId).trim();
      if (!normalizedUserId) {
        setError('User ID is required.');
        return;
      }
      await axios.post(`/api/clubs/${clubId}/organizers`, { userId: normalizedUserId });
      setNewOrganizerId('');
      await loadData();
      setNotice('Organizer added successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add organizer.');
    }
  };

  const handleKickMember = async (memberId) => {
    try {
      setNotice(null);
      await axios.delete(`/api/clubs/${clubId}/members/${memberId}`);
      await loadData();
      setNotice('Member removed from club.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove member.');
    }
  };

  const handleCreateEvent = async () => {
    try {
      setNotice(null);
      const res = await axios.post('/api/events', {
        ...newEvent,
        clubId,
      });
      const created = res.data;
      setNewEvent({ title: '', description: '', date: '', time: '', location: '' });
      await loadData();
      setAnnouncement((prev) => ({ ...prev, eventId: created.id }));
      setNotice('Event created successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create event.');
    }
  };

  const handleCreateAnnouncement = async () => {
    try {
      setNotice(null);
      await axios.post(`/api/events/${announcement.eventId}/announcements`, {
        message: announcement.message,
      });
      setAnnouncement((prev) => ({ ...prev, message: '' }));
      setNotice('Announcement posted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to post announcement.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)]">
        Loading organizer dashboard...
      </div>
    );
  }

  if (error && !club) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] gap-3">
        <p>{error}</p>
        <button className="text-sm text-[var(--color-purdue-gold)]" onClick={() => navigate(`/clubs/${clubId}`)}>Back to Club</button>
      </div>
    );
  }

  if (!isOrganizer) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] gap-3">
        <p>You do not have permission to access this organizer dashboard.</p>
        <button className="text-sm text-[var(--color-purdue-gold)]" onClick={() => navigate(`/clubs/${clubId}`)}>Back to Club</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] px-8 py-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs tracking-widest uppercase text-[var(--color-purdue-gold)]">Organizer</p>
            <h1 className="text-3xl font-bold">{club?.name} Dashboard</h1>
          </div>
          <button className="text-sm text-[var(--color-text-secondary)]" onClick={() => navigate(`/clubs/${clubId}`)}>Back to Club</button>
        </div>

        {notice && <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">{notice}</div>}
        {error && <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Organizers">
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Current organizer IDs</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(club?.organizerIds || []).map((oid) => (
                <span key={oid} className="text-xs px-2 py-1 rounded bg-white/10">{String(oid)}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newOrganizerId}
                onChange={(e) => setNewOrganizerId(e.target.value)}
                placeholder="User ID to promote"
                className="flex-1 px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
              />
              <button onClick={handleAddOrganizer} className="px-4 py-2 bg-[var(--color-purdue-gold)] text-black rounded text-sm font-semibold">Add</button>
            </div>
          </Panel>

          <Panel title="Members">
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {membersLoading && <p className="text-sm text-[var(--color-text-secondary)]">Loading members...</p>}
              {!membersLoading && members.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">No members found.</p>}
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{m.displayName || m.email}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{m.email}</p>
                  </div>
                  <button onClick={() => handleKickMember(m.id)} className="text-xs text-red-300 hover:text-red-200">Kick</button>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Create Event">
            <div className="grid grid-cols-1 gap-2">
              <Input value={newEvent.title} onChange={(v) => setNewEvent((p) => ({ ...p, title: v }))} placeholder="Title" />
              <Input value={newEvent.description} onChange={(v) => setNewEvent((p) => ({ ...p, description: v }))} placeholder="Description" />
              <Input value={newEvent.date} onChange={(v) => setNewEvent((p) => ({ ...p, date: v }))} placeholder="Date (YYYY-MM-DD)" />
              <Input value={newEvent.time} onChange={(v) => setNewEvent((p) => ({ ...p, time: v }))} placeholder="Time (HH:mm)" />
              <Input value={newEvent.location} onChange={(v) => setNewEvent((p) => ({ ...p, location: v }))} placeholder="Location" />
              <button onClick={handleCreateEvent} className="mt-1 px-4 py-2 bg-[var(--color-purdue-gold)] text-black rounded text-sm font-semibold">Create Event</button>
            </div>
          </Panel>

          <Panel title="Post Announcement">
            <div className="grid grid-cols-1 gap-2">
              <select
                value={announcement.eventId}
                onChange={(e) => setAnnouncement((p) => ({ ...p, eventId: e.target.value }))}
                className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
              >
                <option value="">Select event</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              <textarea
                rows={5}
                value={announcement.message}
                onChange={(e) => setAnnouncement((p) => ({ ...p, message: e.target.value }))}
                placeholder="Announcement message"
                className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
              />
              <button onClick={handleCreateAnnouncement} className="px-4 py-2 bg-[var(--color-purdue-gold)] text-black rounded text-sm font-semibold">Post Announcement</button>
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[var(--color-surface-light)] p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
    />
  );
}
