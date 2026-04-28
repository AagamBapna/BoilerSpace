import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

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

function shiftDateToWeekday(dateValue, targetWeekdayValue) {
  const normalized = String(dateValue || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return dateValue;
  const targetDay = Number.parseInt(targetWeekdayValue, 10);
  if (!Number.isInteger(targetDay) || targetDay < 0 || targetDay > 6) return normalized;

  const date = new Date(`${normalized}T12:00:00`);
  if (Number.isNaN(date.getTime())) return normalized;

  const offset = (targetDay - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + offset);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ClubOrganizerDashboard({ user }) {
  const { id: clubId } = useParams();
  const navigate = useNavigate();

  const [club, setClub] = useState(null);
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState(null);
  const [newPositionName, setNewPositionName] = useState('');
  const [positionsSaving, setPositionsSaving] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingEventScope, setEditingEventScope] = useState('single');
  const [showDeleteEventModal, setShowDeleteEventModal] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [deleteEventScope, setDeleteEventScope] = useState('single');
  const [deletingEventId, setDeletingEventId] = useState(null);
  const [savingEventId, setSavingEventId] = useState(null);
  const [editEventForm, setEditEventForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    recurrenceType: 'none',
    recurrenceEndDate: '',
    recurrenceDayOfWeek: '',
  });
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
  const [dashboardAccessRole, setDashboardAccessRole] = useState(null);

  const isOrganizer = useMemo(() => {
    const viewerId = String(user?.id || user?._id || '');
    return Boolean(viewerId && Array.isArray(club?.organizerIds) && club.organizerIds.map(String).includes(viewerId));
  }, [club, user]);

  const viewerId = String(user?.id || user?._id || '');
  const viewerMembership = useMemo(
    () => members.find((m) => String(m.id) === viewerId) || null,
    [members, viewerId]
  );
  const viewerRole = viewerMembership?.role || dashboardAccessRole || (isOrganizer ? 'admin' : 'member');
  const canViewDashboard = viewerRole === 'admin' || viewerRole === 'officer';
  const canManagePositions = viewerRole === 'admin';

  const loadMembers = async () => {
    try {
      setMembersLoading(true);
      const [membersRes, pendingRes, positionsRes] = await Promise.all([
        axios.get(`/api/clubs/${clubId}/members`),
        axios.get(`/api/clubs/${clubId}/pending-members`),
        axios.get(`/api/clubs/${clubId}/positions`),
      ]);
      setMembers(membersRes.data || []);
      setPendingMembers(pendingRes.data || []);
      setPositions(positionsRes.data?.positions || ['Member']);
    } catch (err) {
      setMembers([]);
      setPendingMembers([]);
      setPositions(['Member']);
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

      const accessRes = await axios.get(`/api/clubs/${clubId}/access`);
      const role = String(accessRes.data?.role || 'member').toLowerCase();
      setDashboardAccessRole(role);

      if (role !== 'admin' && role !== 'officer') {
        setEvents([]);
        setMembers([]);
        setPendingMembers([]);
        setAnnouncements([]);
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
      setDashboardAccessRole(null);
      setClub(null);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to load organizer dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clubId, user?.id, user?._id]);

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

  const handleApproveMember = async (memberId) => {
    try {
      setNotice(null);
      setError(null);
      await axios.post(`/api/clubs/${clubId}/members/${memberId}/approve`);
      setNotice('Membership request approved.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to approve member.');
    }
  };

  const handleRemovePendingRequest = async (memberId) => {
    try {
      setNotice(null);
      setError(null);
      await axios.delete(`/api/clubs/${clubId}/members/${memberId}`);
      setNotice('Request removed.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove request.');
    }
  };

  const handleDemoteOrganizer = async (memberId) => {
    try {
      setNotice(null);
      setError(null);
      await axios.delete(`/api/clubs/${clubId}/organizers/${memberId}`);
      setNotice('Organizer demoted to member.');
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to demote organizer.');
    }
  };

  const canManageMember = (member) => {
    const targetRole = member?.role || (organizerIdSet.has(String(member?.id)) ? 'admin' : 'member');
    if (viewerRole === 'admin') return true;
    if (viewerRole === 'officer') {
      return targetRole === 'member' && String(member?.id) !== viewerId;
    }
    return false;
  };

  const handleUpdateMemberRolePosition = async (memberId, payload) => {
    try {
      setSavingMemberId(String(memberId));
      setNotice(null);
      setError(null);
      await axios.patch(`/api/clubs/${clubId}/members/${memberId}/role`, payload);
      await loadMembers();
      setNotice('Member role/position updated.');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update member role/position.');
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleAddPosition = async () => {
    const trimmed = String(newPositionName || '').trim();
    if (!trimmed) {
      setError('Position name is required.');
      return;
    }

    try {
      setPositionsSaving(true);
      setNotice(null);
      setError(null);
      const res = await axios.post(`/api/clubs/${clubId}/positions`, { name: trimmed });
      setPositions(res.data?.positions || []);
      setNewPositionName('');
      setNotice('Position added.');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to add position.');
    } finally {
      setPositionsSaving(false);
    }
  };

  const handleRenamePosition = async (oldName) => {
    const nextName = window.prompt(`Rename "${oldName}" to:`, oldName);
    if (!nextName || !nextName.trim() || nextName.trim() === oldName) return;

    try {
      setPositionsSaving(true);
      setNotice(null);
      setError(null);
      const encoded = encodeURIComponent(oldName);
      const res = await axios.patch(`/api/clubs/${clubId}/positions/${encoded}`, { name: nextName.trim() });
      setPositions(res.data?.positions || []);
      setNotice('Position updated.');
      await loadMembers();
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to rename position.');
    } finally {
      setPositionsSaving(false);
    }
  };

  const handleDeletePosition = async (positionName) => {
    const confirmed = window.confirm(`Delete position "${positionName}"?`);
    if (!confirmed) return;

    try {
      setPositionsSaving(true);
      setNotice(null);
      setError(null);
      const encoded = encodeURIComponent(positionName);
      const res = await axios.delete(`/api/clubs/${clubId}/positions/${encoded}`);
      setPositions(res.data?.positions || []);
      setNotice('Position deleted.');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to delete position.');
    } finally {
      setPositionsSaving(false);
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

  const handleDeleteEventClick = (eventId) => {
    const selectedEvent = events.find((event) => String(event.id) === String(eventId));
    if (!selectedEvent) return;
    setDeletingEvent(selectedEvent);
    setDeleteEventScope('single');
    setShowDeleteEventModal(true);
  };

  const handleConfirmDeleteEvent = async () => {
    if (!deletingEvent?.id) return;
    const isRecurring = Boolean(deletingEvent?.recurrence?.type && deletingEvent.recurrence.type !== 'none');
    const scope = isRecurring ? deleteEventScope : 'single';
    try {
      setDeletingEventId(String(deletingEvent.id));
      setNotice(null);
      setError(null);
      await axios.delete(`/api/events/${deletingEvent.id}?scope=${encodeURIComponent(scope)}`);
      await loadData();
      setShowDeleteEventModal(false);
      setDeletingEvent(null);
      setNotice('Event deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete event.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleEditEventClick = (event) => {
    const weekdayFromEventDate = getDayOfWeekValue(event.date);
    setNotice(null);
    setError(null);
    setEditingEvent(event);
    setEditingEventScope('single');
    setEditEventForm({
      title: event.title || '',
      description: event.description || '',
      date: event.date || '',
      time: event.time || '',
      location: event.location || '',
      recurrenceType: event.recurrence?.type || 'none',
      recurrenceEndDate: event.recurrence?.endDate || '',
      recurrenceDayOfWeek: event.recurrence?.type === 'weekly'
        ? weekdayFromEventDate
        : (event.recurrence?.dayOfWeek !== undefined && event.recurrence?.dayOfWeek !== null
            ? String(event.recurrence.dayOfWeek)
            : weekdayFromEventDate),
    });
    setShowEditEventModal(true);
  };

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    try {
      setSavingEventId(String(editingEvent.id));
      setNotice(null);
      setError(null);
      const payload = {
        title: editEventForm.title,
        description: editEventForm.description,
        date: editEventForm.date,
        time: editEventForm.time,
        location: editEventForm.location,
      };

      if (editingEventScope !== 'single') {
        const recurrencePayload = {
          type: editEventForm.recurrenceType,
          endDate: editEventForm.recurrenceEndDate,
        };

        if (editEventForm.recurrenceType === 'weekly') {
          recurrencePayload.dayOfWeek = String(editEventForm.recurrenceDayOfWeek || getDayOfWeekValue(editEventForm.date) || '');
        }

        payload.recurrence = editEventForm.recurrenceType === 'none'
          ? { type: 'none' }
          : recurrencePayload;
      }

      await axios.patch(`/api/events/${editingEvent.id}?scope=${encodeURIComponent(editingEventScope)}`, {
        ...payload,
      });
      setShowEditEventModal(false);
      setEditingEvent(null);
      await loadData();
      setNotice('Event updated.');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update event.');
    } finally {
      setSavingEventId(null);
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

  if (!canViewDashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--color-surface-light)] text-[var(--color-text-primary)] gap-3">
        <p>You do not have permission to access this organizer dashboard.</p>
        <button className="text-sm text-[var(--color-purdue-gold)]" onClick={() => navigate(`/clubs/${clubId}`)}>Back to Club</button>
      </div>
    );
  }

  const organizerIdSet = new Set((club?.organizerIds || []).map(String));

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 px-6 pb-24">
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
          <Panel title="Pending Requests">
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
              {membersLoading && <p className="text-sm text-[var(--color-text-secondary)]">Loading requests...</p>}
              {!membersLoading && pendingMembers.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">No pending requests.</p>
              )}
              {pendingMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-white/5 rounded px-3 py-2 gap-3">
                  <div>
                    <p className="text-sm font-medium">{m.displayName || m.email}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleApproveMember(m.id)}
                      className="text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleRemovePendingRequest(m.id)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

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
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-emerald-300">Organizer</span>
                      {String(m.id) !== String(user?.id || user?._id || '') && (
                        <button
                          onClick={() => handleDemoteOrganizer(m.id)}
                          className="text-xs text-amber-300 hover:text-amber-200"
                        >
                          Demote
                        </button>
                      )}
                    </div>
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
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      Role: <span className="text-[var(--color-text-primary)] capitalize">{m.role || (organizerIdSet.has(String(m.id)) ? 'admin' : 'member')}</span>
                      {' · '}
                      Position: <span className="text-[var(--color-text-primary)]">{m.position || 'Member'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {canManageMember(m) ? (
                      <>
                        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                          <span>Permissions</span>
                          <select
                            aria-label="Permissions"
                            value={m.role || (organizerIdSet.has(String(m.id)) ? 'admin' : 'member')}
                            onChange={(e) => handleUpdateMemberRolePosition(m.id, { role: e.target.value })}
                            disabled={savingMemberId === String(m.id)}
                            className="text-xs bg-[var(--color-surface-light)] border border-white/15 rounded px-2 py-1 text-[var(--color-text-primary)]"
                          >
                            <option value="member">member</option>
                            <option value="officer">officer</option>
                            {viewerRole === 'admin' && <option value="admin">admin</option>}
                          </select>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                          <span>Position</span>
                          <select
                            aria-label="Position"
                            value={m.position || 'Member'}
                            onChange={(e) => handleUpdateMemberRolePosition(m.id, { position: e.target.value })}
                            disabled={savingMemberId === String(m.id)}
                            className="text-xs bg-[var(--color-surface-light)] border border-white/15 rounded px-2 py-1 text-[var(--color-text-primary)]"
                          >
                            {positions.map((positionName) => (
                              <option key={positionName} value={positionName}>{positionName}</option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : (
                      <span className="text-xs text-[var(--color-text-secondary)]">View only</span>
                    )}
                    {!organizerIdSet.has(String(m.id)) && (
                      <button onClick={() => handleKickMember(m.id)} className="text-xs text-red-300 hover:text-red-200">Kick</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Custom Positions">
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  placeholder="New position (e.g., Treasurer)"
                  disabled={!canManagePositions || positionsSaving}
                  className="flex-1 px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/15 text-sm"
                />
                <button
                  onClick={handleAddPosition}
                  disabled={!canManagePositions || positionsSaving}
                  className="text-xs px-3 py-2 rounded bg-[var(--color-purdue-gold)] text-black font-semibold disabled:opacity-60"
                >
                  Add
                </button>
              </div>

              {!canManagePositions && (
                <p className="text-xs text-[var(--color-text-secondary)]">Only admins can create, rename, or delete positions.</p>
              )}

              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {positions.map((positionName) => (
                  <div key={positionName} className="flex items-center justify-between bg-white/5 rounded px-3 py-2">
                    <span className="text-sm">{positionName}</span>
                    <div className="flex items-center gap-3">
                      {canManagePositions && (
                        <button
                          onClick={() => handleRenamePosition(positionName)}
                          disabled={positionsSaving}
                          className="text-xs text-[var(--color-purdue-gold)] hover:text-[var(--color-purdue-gold-light)] disabled:opacity-60"
                        >
                          Rename
                        </button>
                      )}
                      {canManagePositions && positionName.toLowerCase() !== 'member' && (
                        <button
                          onClick={() => handleDeletePosition(positionName)}
                          disabled={positionsSaving}
                          className="text-xs text-red-300 hover:text-red-200 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleEditEventClick(event)} className="text-xs text-[var(--color-purdue-gold)] hover:text-[var(--color-purdue-gold-light)]">Edit</button>
                    <button onClick={() => handleDeleteEventClick(event.id)} className="text-xs text-red-300 hover:text-red-200">Delete</button>
                  </div>
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
          <div className="modal-inner w-full max-w-2xl rounded-2xl bg-[var(--color-surface-light)] p-7 flex flex-col gap-5">
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
                  className="profile-button-like profile-button-gold text-black rounded text-base font-semibold disabled:opacity-60"
                >
                  {savingClub ? 'Saving...' : 'Save Club Details'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditEventModal && editingEvent && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="modal-inner w-full max-w-2xl rounded-2xl bg-[var(--color-surface-light)] flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Edit Event</h2>
              <button
                onClick={() => !savingEventId && setShowEditEventModal(false)}
                className="profile-button-like px-5 py-2.5 text-base"
                disabled={Boolean(savingEventId)}
              >
                Close
              </button>
            </div>

            {(editingEvent?.recurrence?.type && editingEvent.recurrence.type !== 'none') && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-secondary)]">Apply changes to</label>
                <select
                  value={editingEventScope}
                  onChange={(e) => setEditingEventScope(e.target.value)}
                  className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
                >
                  <option value="single">This event only</option>
                  <option value="future">This and future events</option>
                  <option value="all">Entire series</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Title</label>
                  <Input value={editEventForm.title} onChange={(v) => setEditEventForm((prev) => ({ ...prev, title: v }))} placeholder="Event title" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Location</label>
                  <Input value={editEventForm.location} onChange={(v) => setEditEventForm((prev) => ({ ...prev, location: v }))} placeholder="Location" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-secondary)]">Description</label>
                <textarea
                  rows={4}
                  value={editEventForm.description}
                  onChange={(e) => setEditEventForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description"
                  className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Start Date</label>
                  <Input
                    type="date"
                    value={editEventForm.date}
                    onChange={(v) => setEditEventForm((prev) => ({
                      ...prev,
                      date: v,
                      recurrenceDayOfWeek: prev.recurrenceType === 'weekly'
                        ? (editingEventScope === 'single'
                            ? getDayOfWeekValue(v)
                            : (prev.recurrenceDayOfWeek || getDayOfWeekValue(v)))
                        : prev.recurrenceDayOfWeek,
                    }))}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Time</label>
                  <Input type="time" value={editEventForm.time} onChange={(v) => setEditEventForm((prev) => ({ ...prev, time: v }))} placeholder="HH:mm" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Recurrence</label>
                  <select
                    value={editEventForm.recurrenceType}
                    onChange={(e) => setEditEventForm((prev) => ({
                      ...prev,
                      recurrenceType: e.target.value,
                      recurrenceDayOfWeek: e.target.value === 'weekly' ? (prev.recurrenceDayOfWeek || getDayOfWeekValue(prev.date)) : '',
                    }))}
                    className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
                  >
                    <option value="none">None</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">End Date</label>
                  <Input type="date" value={editEventForm.recurrenceEndDate} onChange={(v) => setEditEventForm((prev) => ({ ...prev, recurrenceEndDate: v }))} placeholder="YYYY-MM-DD" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--color-text-secondary)]">Day of Week</label>
                  <select
                    value={editEventForm.recurrenceType === 'weekly' ? (editEventForm.recurrenceDayOfWeek || getDayOfWeekValue(editEventForm.date)) : ''}
                    onChange={(e) => setEditEventForm((prev) => ({
                      ...prev,
                      recurrenceDayOfWeek: e.target.value,
                      date: editingEventScope === 'single' && prev.recurrenceType === 'weekly'
                        ? shiftDateToWeekday(prev.date, e.target.value)
                        : prev.date,
                    }))}
                    disabled={editEventForm.recurrenceType !== 'weekly'}
                    className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm disabled:opacity-60"
                  >
                    <option value="">Select day</option>
                    {DAY_OF_WEEK_OPTIONS.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowEditEventModal(false)}
                disabled={Boolean(savingEventId)}
                className="profile-button-like px-5 py-2.5 text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEvent}
                disabled={Boolean(savingEventId)}
                className="profile-button-like profile-button-gold text-black rounded text-base font-semibold disabled:opacity-60"
              >
                {savingEventId ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteEventModal && deletingEvent && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center px-6">
          <div className="w-full max-w-2xl rounded-2xl bg-[var(--color-surface-light)] border border-red-500/30 p-7 sm:p-8 flex flex-col gap-5">
            <h2 className="text-2xl font-bold text-red-200">Delete Event</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {Boolean(deletingEvent?.recurrence?.type && deletingEvent.recurrence.type !== 'none')
                ? 'Choose what to delete from this recurring series.'
                : 'Delete this event? This will also delete related announcements.'}
            </p>

            {Boolean(deletingEvent?.recurrence?.type && deletingEvent.recurrence.type !== 'none') && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--color-text-secondary)]">Delete scope</label>
                <select
                  value={deleteEventScope}
                  onChange={(e) => setDeleteEventScope(e.target.value)}
                  className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
                >
                  <option value="single">This event only</option>
                  <option value="future">This and future events</option>
                  <option value="all">Entire series</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => {
                  if (deletingEventId) return;
                  setShowDeleteEventModal(false);
                  setDeletingEvent(null);
                }}
                disabled={Boolean(deletingEventId)}
                className="profile-button-like px-5 py-2.5 text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteEvent}
                disabled={Boolean(deletingEventId)}
                className="profile-button-like profile-button-danger px-5 py-2.5 text-base disabled:opacity-60"
              >
                {deletingEventId ? 'Deleting...' : 'Delete Event'}
              </button>
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

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="px-3 py-2 rounded bg-[var(--color-surface-light)] border border-white/10 text-sm"
    />
  );
}
