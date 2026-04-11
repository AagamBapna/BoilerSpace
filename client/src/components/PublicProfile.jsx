import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CourseSelector from './CourseSelector';
import AvailabilityEditor from './AvailabilityEditor';

export default function PublicProfile({ user, onUserUpdate }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit mode state (own profile only)
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState('');
  const [bio, setBio] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef(null);

  const isSelf = user && profile && user.id === profile._id;

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get(`/api/users/${userId}`)
      .then(res => {
        setProfile(res.data);
        // Prefill edit fields if own profile
        setDisplayName(res.data.displayName || '');
        setMajor(res.data.major || '');
        setYear(res.data.year || '');
        setBio(res.data.bio || '');
        setProfilePictureUrl(res.data.profilePictureUrl || '');
      })
      .catch(err => {
        if (err.response?.status === 404) setError('User not found.');
        else setError('Failed to load profile.');
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await axios.put(`/api/users/${userId}`, {
        displayName,
        major,
        year,
        bio,
      });
      setSaveSuccess(true);
      setEditing(false);
      setProfile(prev => ({ ...prev, ...res.data.user, profilePictureUrl }));
      if (onUserUpdate) onUserUpdate({ ...res.data.user, profilePictureUrl });
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(profile.displayName || '');
    setMajor(profile.major || '');
    setYear(profile.year || '');
    setBio(profile.bio || '');
    setEditing(false);
    setSaveError(null);
  };

  const handlePictureSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setSaveError('Invalid file type. Only PNG and JPEG images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('File size exceeds the 5MB limit.');
      return;
    }
    setUploadingPicture(true);
    setSaveError(null);
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      const res = await axios.put(`/api/users/${userId}/profile-picture`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfilePictureUrl(res.data.user.profilePictureUrl);
      setProfile(prev => ({ ...prev, profilePictureUrl: res.data.user.profilePictureUrl }));
      if (onUserUpdate) onUserUpdate(res.data.user);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to upload profile picture.');
    } finally {
      setUploadingPicture(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePicture = async () => {
    setUploadingPicture(true);
    setSaveError(null);
    try {
      const res = await axios.delete(`/api/users/${userId}/profile-picture`);
      setProfilePictureUrl('');
      setProfile(prev => ({ ...prev, profilePictureUrl: '' }));
      if (onUserUpdate) onUserUpdate(res.data.user);
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to remove profile picture.');
    } finally {
      setUploadingPicture(false);
    }
  };

  const getGradYear = (yr) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    let academicYear = currentMonth >= 8 ? currentYear + 1 : currentYear;
    const yearMap = { Freshman: academicYear + 3, Sophomore: academicYear + 2, Junior: academicYear + 1, Senior: academicYear };
    return yearMap[yr] || null;
  };

  const isPrivate = profile?.profileVisibility === 'private' && !profile?.courses;

  // ── Connection state machine ──
  const [connecting, setConnecting] = useState(false);
  const [actionError, setActionError] = useState(null);

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
      setActionError(err.response?.data?.error || 'Failed to decline request.');
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
      setActionError(err.response?.data?.error || 'Failed to remove friend.');
    } finally {
      setConnecting(false);
    }
  };

  const topActionClass = 'profile-button-like min-w-[100px] justify-center';

  // -- Avatar helper --
  const avatarUrl = profilePictureUrl || profile?.profilePictureUrl;
  const avatarLetter = (displayName || profile?.displayName)?.[0] || '?';

  const renderAvatar = (size = 'w-20 h-20', textSize = 'text-2xl') => avatarUrl ? (
    <img src={avatarUrl} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <div className={`${size} rounded-full bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center text-black font-bold ${textSize}`}>
      {avatarLetter}
    </div>
  );

  //  Render 
  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface)] text-[var(--color-text-primary)] py-10 px-6">
      {/* Top nav */}
      <div className="page-top-actions">
        <button onClick={() => navigate('/')} className={topActionClass}>Map</button>
        <button onClick={() => navigate('/clubs')} className={topActionClass}>Clubs</button>
        <button onClick={() => navigate('/activity')} className={topActionClass}>Activity</button>
      </div>

      <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 pt-14 sm:pt-16">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading profile...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
            <button onClick={() => navigate(-1)} className="text-xs text-[var(--color-purdue-gold)] hover:underline">Go back</button>
          </div>
        )}

        {/* Profile loaded */}
        {!loading && !error && profile && (
          <>
            {/* Hidden file input */}
            {isSelf && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handlePictureSelect}
              />
            )}

            {/* Feedback messages */}
            {saveError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                Profile updated successfully!
              </div>
            )}

            {/* ── Header Card ── */}
            <div className="p-6 bg-[var(--color-surface-light)] rounded-2xl border border-[var(--color-border)]">
              {editing ? (
                /* ── Edit Mode ── */
                <div className="space-y-4">
                  {/* Avatar upload */}
                  <div className="flex items-center gap-4">
                    <div
                      className="relative w-20 h-20 rounded-full cursor-pointer group flex-shrink-0"
                      onClick={() => !uploadingPicture && fileInputRef.current?.click()}
                    >
                      {uploadingPicture ? (
                        <div className="w-full h-full rounded-full bg-[var(--color-surface)] flex items-center justify-center">
                          <div className="w-5 h-5 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
                        </div>
                      ) : (
                        <>
                          {renderAvatar()}
                          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPicture}
                        className="text-xs text-[var(--color-purdue-gold)] hover:underline disabled:opacity-50 text-left"
                      >Change Photo</button>
                      {profilePictureUrl && (
                        <button
                          onClick={handleRemovePicture}
                          disabled={uploadingPicture}
                          className="text-xs text-red-400 hover:underline disabled:opacity-50 text-left"
                        >Remove Photo</button>
                      )}
                    </div>
                  </div>

                  {/* Fields */}
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Display Name</label>
                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Bio</label>
                    <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300} rows={3} placeholder="Tell others about yourself..."
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)] resize-none" />
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-right">{bio.length}/300</p>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Major</label>
                    <input type="text" value={major} onChange={e => setMajor(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Year</label>
                    <select value={year} onChange={e => setYear(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]">
                      <option value="">Select Year</option>
                      <option value="Freshman">Freshman</option>
                      <option value="Sophomore">Sophomore</option>
                      <option value="Junior">Junior</option>
                      <option value="Senior">Senior</option>
                    </select>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleCancel}
                      className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                      Cancel
                    </button>
                    <button onClick={handleSaveProfile} disabled={saving}
                      className="px-4 py-2 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-sm hover:opacity-90 disabled:opacity-50">
                      {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <div className="flex flex-col items-center text-center gap-3">
                  {renderAvatar('w-24 h-24', 'text-3xl')}
                  <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{profile.displayName}</h1>
                    {!isPrivate && (
                      <div className="flex items-center justify-center gap-2 mt-1 text-sm text-[var(--color-text-secondary)]">
                        {profile.major && <span>{profile.major}</span>}
                        {profile.major && profile.year && <span>·</span>}
                        {profile.year && <span>{profile.year}{getGradYear(profile.year) ? ` · Class of ${getGradYear(profile.year)}` : ''}</span>}
                      </div>
                    )}
                    {isSelf && profile.email && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{profile.email}</p>
                    )}
                  </div>

                  {/* Bio */}
                  {!isPrivate && profile.bio && (
                    <p className="text-sm text-[var(--color-text-secondary)] max-w-md leading-relaxed">{profile.bio}</p>
                  )}

                  {/* Own profile: Edit button */}
                  {isSelf && (
                    <button onClick={() => setEditing(true)}
                      className="mt-2 px-5 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] hover:border-[var(--color-purdue-gold)] transition-colors">
                      Edit Profile
                    </button>
                  )}

                  {/* Private profile message */}
                  {isPrivate && !isSelf && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-2">This profile is private.</p>
                  )}

                  {/* Connect / Friendship action buttons */}
                  {!isSelf && !isPrivate && (
                    <div className="w-full max-w-xs mt-2">
                      {profile.connectionStatus === 'none' && (
                        <button
                          id="connect-button"
                          onClick={handleConnect}
                          disabled={connecting}
                          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors disabled:opacity-50"
                        >
                          {connecting ? 'Sending...' : 'Connect'}
                        </button>
                      )}
                      {profile.connectionStatus === 'pending_outgoing' && (
                        <button
                          onClick={handleCancelRequest}
                          disabled={connecting}
                          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                        >
                          {connecting ? 'Cancelling...' : 'Request Pending — Cancel'}
                        </button>
                      )}
                      {profile.connectionStatus === 'pending_incoming' && (
                        <div className="flex gap-2">
                          <button
                            id="accept-request-button"
                            onClick={handleAcceptRequest}
                            disabled={connecting}
                            className="flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors disabled:opacity-50"
                          >
                            {connecting ? 'Accepting...' : 'Accept Request'}
                          </button>
                          <button
                            onClick={handleRejectRequest}
                            disabled={connecting}
                            className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {profile.connectionStatus === 'accepted' && (
                        <div className="flex flex-col gap-2">
                          <div className="w-full py-2.5 text-sm font-semibold rounded-lg bg-green-500/20 text-green-400 text-center flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Friends
                          </div>
                          <button
                            onClick={handleUnfriend}
                            disabled={connecting}
                            className="w-full py-2 text-xs rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            {connecting ? 'Removing...' : 'Unfriend'}
                          </button>
                        </div>
                      )}
                      {actionError && (
                        <p className="text-xs text-red-400 mt-2 text-center">{actionError}</p>
                      )}
                    </div>
                  )}
                  {!isSelf && isPrivate && profile.connectionStatus !== 'accepted' && (
                    <div className="w-full max-w-xs mt-2">
                      {profile.connectionStatus === 'none' && (
                        <button
                          onClick={handleConnect}
                          disabled={connecting}
                          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors disabled:opacity-50"
                        >
                          {connecting ? 'Sending...' : 'Send Friend Request'}
                        </button>
                      )}
                      {profile.connectionStatus === 'pending_outgoing' && (
                        <div className="w-full py-2.5 text-sm font-semibold rounded-lg bg-yellow-500/20 text-yellow-400 text-center">
                          Request Pending
                        </div>
                      )}
                      {actionError && (
                        <p className="text-xs text-red-400 mt-2 text-center">{actionError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Courses Section ── */}
            {!isPrivate && (
              <>
                {isSelf ? (
                  /* Own profile: editable course selector */
                  <div className="p-6 bg-[var(--color-surface-light)] rounded-2xl border border-[var(--color-border)]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">My Courses</h3>
                    <CourseSelector userId={userId} embedded={true} />
                  </div>
                ) : (
                  /* Other profile: read-only courses */
                  profile.courses && profile.courses.length > 0 && (
                    <div className="p-6 bg-[var(--color-surface-light)] rounded-2xl border border-[var(--color-border)]">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">Courses</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.courses.map(course => (
                          <span key={course._id || course}
                            className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-purdue-gold)]/10 text-[var(--color-purdue-gold)] font-medium">
                            {course.courseCode || course}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </>
            )}

            {/* ── Availability Section ── */}
            {!isPrivate && (
              <>
                {isSelf ? (
                  <div className="p-6 bg-[var(--color-surface-light)] rounded-2xl border border-[var(--color-border)]">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">Study Availability</h3>
                    <AvailabilityEditor />
                  </div>
                ) : (
                  profile.availability && profile.availability.length > 0 && (
                    <div className="p-6 bg-[var(--color-surface-light)] rounded-2xl border border-[var(--color-border)]">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">Study Availability</h3>
                      <div className="flex flex-col gap-2">
                        {profile.availability.map((slot, i) => (
                          <div key={i} className="flex justify-between text-sm text-[var(--color-text-secondary)] px-1">
                            <span className="font-medium text-[var(--color-text-primary)]">{slot.day}</span>
                            <span>{slot.startTime} – {slot.endTime}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </>
            )}

            {/* Bottom spacing */}
            <div className="h-8" />
          </>
        )}
      </div>
    </div>
  );
}
