import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ClassmateProfile({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Connection state machine ──
  const [connecting, setConnecting] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get(`/api/users/${userId}`)
      .then(res => {
        setProfile(res.data);
      })
      .catch(err => {
        if (err.response?.status === 404) setError('User not found.');
        else setError('Failed to load profile.');
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleConnect = async () => {
    setConnecting(true);
    setActionError(null);
    try {
      const res = await axios.post('/api/friendships/request', { recipientId: userId });
      setProfile(prev => ({ ...prev, connectionStatus: 'pending_outgoing', friendshipId: res.data._id }));
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to send connection request.');
    } finally {
      setConnecting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!profile.friendshipId) return;
    setConnecting(true);
    setActionError(null);
    try {
      await axios.delete(`/api/friendships/${profile.friendshipId}`);
      setProfile(prev => ({ ...prev, connectionStatus: 'none', friendshipId: null }));
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to cancel request.');
    } finally {
      setConnecting(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!profile.friendshipId) return;
    setConnecting(true);
    setActionError(null);
    try {
      await axios.put(`/api/friendships/${profile.friendshipId}/accept`);
      setProfile(prev => ({ ...prev, connectionStatus: 'accepted' }));
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to accept request.');
    } finally {
      setConnecting(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!profile.friendshipId) return;
    setConnecting(true);
    setActionError(null);
    try {
      await axios.put(`/api/friendships/${profile.friendshipId}/reject`);
      setProfile(prev => ({ ...prev, connectionStatus: 'none', friendshipId: null }));
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to reject request.');
    } finally {
      setConnecting(false);
    }
  };

  const handleUnfriend = async () => {
    if (!profile.friendshipId) return;
    setConnecting(true);
    setActionError(null);
    try {
      await axios.delete(`/api/friendships/${profile.friendshipId}`);
      setProfile(prev => ({ ...prev, connectionStatus: 'none', friendshipId: null }));
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to unfriend.');
    } finally {
      setConnecting(false);
    }
  };

  const isPrivate = profile?.profileVisibility === 'private' && profile?.connectionStatus !== 'accepted';

  const renderActionButton = () => {
    if (!profile) return null;

    if (profile.connectionStatus === 'none') {
      return (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors disabled:opacity-50"
        >
          {connecting ? 'Sending...' : (isPrivate ? 'Send Friend Request' : 'Connect')}
        </button>
      );
    }

    if (profile.connectionStatus === 'pending_outgoing') {
      return (
        <button
          onClick={handleCancelRequest}
          disabled={connecting}
          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
        >
          {connecting ? 'Cancelling...' : 'Request Pending — Cancel'}
        </button>
      );
    }

    if (profile.connectionStatus === 'pending_incoming') {
      return (
        <div className="flex gap-2 w-full">
          <button
            onClick={handleAcceptRequest}
            disabled={connecting}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors disabled:opacity-50"
          >
            {connecting ? 'Accepting...' : 'Accept Request'}
          </button>
          <button
            onClick={handleRejectRequest}
            disabled={connecting}
            className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      );
    }

    if (profile.connectionStatus === 'accepted') {
      return (
        <div className="flex flex-col gap-2 w-full">
          <div className="w-full py-2.5 text-sm font-semibold rounded-lg bg-green-500/20 text-green-500 text-center flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Friends
          </div>
          <button
            onClick={handleUnfriend}
            disabled={connecting}
            className="w-full py-2 text-xs rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {connecting ? 'Removing...' : 'Unfriend'}
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--color-surface-light)] border border-[var(--color-border)] rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-purdue-gold)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading profile...</p>
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}

        {!loading && !error && profile && (
          <div className="flex flex-col items-center gap-4">
            {/* Avatar */}
            {profile.profilePictureUrl ? (
              <img src={profile.profilePictureUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--color-purdue-gold)]/20 flex items-center justify-center text-2xl font-bold text-[var(--color-purdue-gold)]">
                {profile.displayName?.[0] || '?'}
              </div>
            )}

            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{profile.displayName}</h2>

            {isPrivate ? (
              <p className="text-sm text-[var(--color-text-secondary)]">This profile is private.</p>
            ) : (
              <>
                {/* Info */}
                <div className="flex gap-4 text-sm text-[var(--color-text-secondary)] mb-2">
                  {profile.major && <span>{profile.major}</span>}
                  {profile.year && <span>{profile.year}</span>}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <div className="w-full text-center px-2 mb-2">
                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed italic opacity-90">
                      "{profile.bio}"
                    </p>
                  </div>
                )}

                {/* Courses */}
                {profile.courses && profile.courses.length > 0 && (
                  <div className="w-full mt-2">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Courses</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.courses.map(course => (
                        <span
                          key={course._id || course}
                          className="px-2.5 py-1 text-xs rounded-md bg-[var(--color-purdue-gold)]/10 text-[var(--color-purdue-gold)] font-medium"
                        >
                          {course.courseCode || course}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Availability */}
                {profile.availability && profile.availability.length > 0 && (
                  <div className="w-full mt-2">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Study Availability</h3>
                    <div className="flex flex-col gap-1">
                      {profile.availability.map((slot, i) => (
                        <div key={i} className="flex justify-between text-xs text-[var(--color-text-secondary)] px-1">
                          <span className="font-medium text-[var(--color-text-primary)]">{slot.day}</span>
                          <span>{slot.startTime} – {slot.endTime}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action button */}
            <div className="w-full mt-4">
              {actionError && <p className="text-xs text-red-400 mb-2 text-center">{actionError}</p>}
              {renderActionButton()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
