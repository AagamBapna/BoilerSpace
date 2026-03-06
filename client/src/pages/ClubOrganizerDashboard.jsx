import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

export default function ClubOrganizerDashboard({ user }) {
  const { id: clubId } = useParams();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [clubForm, setClubForm] = useState({
    description: '',
    category: '',
    contactInfo: '',
  });
  const [savingClub, setSavingClub] = useState(false);
  const [showEditClubModal, setShowEditClubModal] = useState(false);
  const [showDeleteClubConfirm, setShowDeleteClubConfirm] = useState(false);

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
      setClubForm({
        description: clubRes.data?.description || '',
        category: clubRes.data?.category || '',
        contactInfo: clubRes.data?.contactInfo || '',
      });

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
      } catch (err) {
        setEvents([]);
        setError(err.response?.data?.error || 'Failed to load club events.');
      }

      try {
        const announcementsRes = await axios.get(`/api/clubs/${clubId}/announcements`);
        setAnnouncements(announcementsRes.data || []);
      } catch (err) {
        setAnnouncements([]);
        setError(err.response?.data?.error || 'Failed to load club announcements.');
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

  const handlePromoteMember = async (memberId) => {
    try {
      setNotice(null);
      setError(null);
      await axios.post(`/api/clubs/${clubId}/organizers`, { userId: memberId });
      setNotice('Member promoted to organizer.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to promote member.');
    }
  };

  const handleSaveClubDetails = async () => {
    const requesterId = user?.id || user?._id;
    if (!requesterId) {
      setError('You must be logged in to update club details.');
      return false;
    }

    try {
      setSavingClub(true);
      setNotice(null);
      setError(null);

      const payload = {
        description: String(clubForm.description || '').trim(),
        category: String(clubForm.category || '').trim(),
        contactInfo: String(clubForm.contactInfo || '').trim(),
      };

      const res = await axios.patch(`/api/clubs/${clubId}`, payload, {
        headers: {
          'X-User-Id': String(requesterId),
        },
      });

      setClub(res.data);
      setNotice('Club details updated.');
      return true;
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update club details.');
      return false;
    } finally {
      setSavingClub(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    const confirmed = window.confirm('Delete this event? This will also delete its announcements.');
    if (!confirmed) return;
    try {
      setNotice(null);
      setError(null);
      await axios.delete(`/api/events/${eventId}`);
      await loadData();
      setNotice('Event deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete event.');
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    const confirmed = window.confirm('Delete this announcement?');
    if (!confirmed) return;
    try {
      setNotice(null);
      setError(null);
      await axios.delete(`/api/clubs/${clubId}/announcements/${announcementId}`);
      await loadData();
      setNotice('Announcement deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete announcement.');
    }
  };

  const handleDeleteClub = async () => {
    try {
      setNotice(null);
      setError(null);
      await axios.delete(`/api/clubs/${clubId}`);
      navigate('/clubs');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete club.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-surface-light)] text-[var(--color-text-primary)]">
        Loading organizer dashboard...
      </div>
    );
  }

  if (error && !club) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--color-surface-light)] text-[var(--color-text-primary)] gap-3">
        <p>{error}</p>
        <button className="text-sm text-[var(--color-purdue-gold)]" onClick={() => navigate(`/clubs/${clubId}`)}>Back to Club</button>
      </div>
    );
  }

  if (!isOrganizer) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--color-surface-light)] text-[var(--color-text-primary)] gap-3">
        <p>You do not have permission to access this organizer dashboard.</p>
        <button className="text-sm text-[var(--color-purdue-gold)]" onClick={() => navigate(`/clubs/${clubId}`)}>Back to Club</button>
      </div>
    );
  }

  const organizerIdSet = new Set((club?.organizerIds || []).map(String));

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6">
      <div className="page-top-actions">
        <button onClick={() => navigate(`/clubs/${clubId}`)} className="profile-button-like">Back to Club</button>
        <button onClick={() => navigate('/clubs')} className="profile-button-like">Clubs</button>
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/activity')} className="profile-button-like">Activity</button>
        <button onClick={() => setShowEditClubModal(true)} className="profile-button-like profile-button-gold">Edit Club Details</button>
      </div>

      <div className="flex flex-col gap-7" style={{ marginLeft: '2rem', marginRight: '2rem', paddingTop: '2rem' }}>
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-widest uppercase text-[var(--color-purdue-gold)]">Organizer</p>
          <h1 className="text-3xl font-bold">{club?.name} Dashboard</h1>
        </div>

        {notice && <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">{notice}</div>}
        {error && <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Organizers">
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {membersLoading && <p className="text-sm text-[var(--color-text-secondary)]">Loading organizers...</p>}
              {!membersLoading && members.filter((m) => organizerIdSet.has(String(m.id))).length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">No organizers found.</p>
              )}
              {members
                .filter((m) => organizerIdSet.has(String(m.id)))
                .map((m) => (
                  <div key={m.id} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{m.displayName || m.email}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{m.email}</p>
                    </div>
                    <span className="text-xs text-emerald-300">Organizer</span>
                  </div>
                ))}
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
                  <div className="flex items-center gap-3">
                    {organizerIdSet.has(String(m.id)) ? (
                      <span className="text-xs text-emerald-300">Organizer</span>
                    ) : (
                      <button
                        onClick={() => handlePromoteMember(m.id)}
                        className="text-xs text-[var(--color-purdue-gold)] hover:text-[var(--color-purdue-gold-light)]"
                      >
                        Promote
                      </button>
                    )}
                    {!organizerIdSet.has(String(m.id)) && (
                      <button onClick={() => handleKickMember(m.id)} className="text-xs text-red-300 hover:text-red-200">Kick</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Manage Events">
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {events.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">No events to manage.</p>}
              {events.map((event) => (
                <div key={event.id} className="flex items-center justify-between bg-white/5 rounded px-3 py-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{event.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{event.date} {event.time ? `· ${event.time}` : ''}</p>
                  </div>
                  <button onClick={() => handleDeleteEvent(event.id)} className="text-xs text-red-300 hover:text-red-200">Delete</button>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Manage Announcements">
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {announcements.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">No announcements to manage.</p>}
              {announcements.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-white/5 rounded px-3 py-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.message}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate">{a.event?.title || 'Club-wide'} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}</p>
                  </div>
                  <button onClick={() => handleDeleteAnnouncement(a.id)} className="text-xs text-red-300 hover:text-red-200">Delete</button>
                </div>
              ))}
            </div>
          </Panel>
        </section>

      </div>

      {showEditClubModal && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--color-surface-light)] p-7 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Edit Club Details</h2>
              <button
                onClick={() => !savingClub && setShowEditClubModal(false)}
                className="profile-button-like px-5 py-2.5 text-base"
                disabled={savingClub}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-secondary)]">Description</label>
                <textarea
                  rows={4}
                  value={clubForm.description}
                  onChange={(e) => setClubForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Club description"
                  className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Category</label>
                  <Input
                    value={clubForm.category}
                    onChange={(v) => setClubForm((prev) => ({ ...prev, category: v }))}
                    placeholder="Category"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Contact Info</label>
                  <Input
                    value={clubForm.contactInfo}
                    onChange={(v) => setClubForm((prev) => ({ ...prev, contactInfo: v }))}
                    placeholder="email@purdue.edu"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowEditClubModal(false)}
                  disabled={savingClub}
                  className="profile-button-like px-5 py-2.5 text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const ok = await handleSaveClubDetails();
                    if (ok) setShowEditClubModal(false);
                  }}
                  disabled={savingClub}
                  className="px-5 py-2.5 bg-[var(--color-purdue-gold)] text-black rounded text-base font-semibold disabled:opacity-60"
                >
                  {savingClub ? 'Saving...' : 'Save Club Details'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowDeleteClubConfirm(true)}
        className="fixed bottom-6 right-6 z-30 profile-button-like profile-button-danger"
      >
        Delete Club
      </button>

      {showDeleteClubConfirm && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--color-surface-light)] border border-red-500/30 p-7 sm:p-8 flex flex-col gap-5">
            <h2 className="text-3xl font-bold text-red-200">Confirm Club Deletion</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              This action is permanent. Deleting this club will remove all related events and announcements.
              Members will also be removed from this club.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowDeleteClubConfirm(false)}
                className="profile-button-like px-5 py-2.5 text-base"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowDeleteClubConfirm(false);
                  await handleDeleteClub();
                }}
                className="profile-button-like profile-button-danger px-5 py-2.5 text-base"
              >
                Yes, Delete Club
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="rounded-xl bg-[var(--color-surface-light)] p-4">
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
