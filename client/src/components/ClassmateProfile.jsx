import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ClassmateProfile({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Connection state machine ──
  const [connecting, setConnecting] = useState(false);
  const [actionError, setActionError] = useState(null);

  // ── Analytics Gamification ──
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [fetchingAnalytics, setFetchingAnalytics] = useState(true);

  // Week Boundary Helper
  const getCurrentWeekBounds = () => {
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return { startDate: monday.toISOString(), endDate: sunday.toISOString() };
  };

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

    // Concurrently fetch Weekly Analytics
    setFetchingAnalytics(true);
    const { startDate, endDate } = getCurrentWeekBounds();
    axios.get(`/api/analytics/weekly/${userId}`, { params: { startDate, endDate } })
        .then(res => setWeeklyMinutes(res.data.totalWeeklyMinutes || 0))
        .catch(err => console.error('Failed to load classmate analytics', err))
        .finally(() => setFetchingAnalytics(false));
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

                {/* Study Preferences */}
                {profile.studyPreferences && (profile.studyPreferences.studyStyle || profile.studyPreferences.environment) && (
                  <div className="w-full mt-2">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Study Preferences</h3>
                    <div className="flex gap-4 text-xs text-[var(--color-text-primary)] px-1">
                      {profile.studyPreferences.studyStyle && (
                         <div className="flex items-center gap-1"><span className="text-[var(--color-text-secondary)]">Style:</span> <span className="capitalize">{profile.studyPreferences.studyStyle}</span></div>
                      )}
                      {profile.studyPreferences.environment && (
                         <div className="flex items-center gap-1"><span className="text-[var(--color-text-secondary)]">Environment:</span> <span className="capitalize">{profile.studyPreferences.environment}</span></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Interests */}
                {profile.interests && profile.interests.length > 0 && (
                  <div className="w-full mt-2">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Interests</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.interests.map((interest, i) => (
                        <span key={i} className="px-2.5 py-1 text-xs rounded-md bg-blue-500/10 text-blue-400 font-medium">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Study Goals */}
                {profile.studyGoals && profile.studyGoals.length > 0 ? (
                  <div className="w-full mt-2">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Study Goals</h3>
                    <ul className="list-disc list-inside text-xs text-[var(--color-text-primary)] space-y-1 ml-1">
                      {profile.studyGoals.map((goal, i) => (
                        <li key={i}>{goal}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="w-full mt-2">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Study Goals</h3>
                    <p className="text-xs text-[var(--color-text-secondary)] italic">No study goals added yet.</p>
                  </div>
                )}
                
                {/* Analytics Widget — uses the user's own configured weekly goal */}
                {!fetchingAnalytics && (() => {
                    const goal = Number.isFinite(profile?.weeklyStudyGoalMinutes) ? profile.weeklyStudyGoalMinutes : 0;
                    const pct = goal > 0 ? Math.min(100, Math.round((weeklyMinutes / goal) * 100)) : 0;
                    const goalH = Math.floor(goal / 60);
                    const goalM = goal % 60;
                    return (
                        <div className="w-full mt-4 p-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl relative overflow-hidden">
                            <div className="flex justify-between items-end mb-1">
                                <div>
                                    <p className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
                                        {Math.floor(weeklyMinutes / 60)}<span className="text-sm opacity-70">h</span> {weeklyMinutes % 60}<span className="text-sm opacity-70">m</span>
                                    </p>
                                    <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-widest mt-0.5">Studied This Week</p>
                                </div>
                                <div className="text-right">
                                    {goal > 0 ? (
                                        <>
                                            <p className="text-[10px] font-semibold text-[var(--color-purdue-gold)]">{pct}% of Weekly Goal</p>
                                            <p className="text-[10px] text-[var(--color-text-secondary)]">Goal: {goalH}h {goalM}m</p>
                                        </>
                                    ) : (
                                        <p className="text-[10px] text-[var(--color-text-secondary)]">No weekly goal set</p>
                                    )}
                                </div>
                            </div>
                            <div className="w-full h-2 bg-black/20 rounded-full mt-2 overflow-hidden border border-[var(--color-border)]">
                                <div className="h-full bg-[var(--color-purdue-gold)] rounded-full shadow-[0_0_8px_var(--color-purdue-gold)] transition-all" style={{ width: `${pct}%` }} />
                            </div>
                        </div>
                    );
                })()}

                {/* Links */}
                {profile.linkedResources && (profile.linkedResources.github || profile.linkedResources.linkedin) && (
                  <div className="w-full mt-2 flex gap-3">
                    {profile.linkedResources.github && (
                      <a href={`https://github.com/${profile.linkedResources.github.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
                        GitHub
                      </a>
                    )}
                    {profile.linkedResources.linkedin && (
                      <a href={`https://linkedin.com/in/${profile.linkedResources.linkedin.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        LinkedIn
                      </a>
                    )}
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
