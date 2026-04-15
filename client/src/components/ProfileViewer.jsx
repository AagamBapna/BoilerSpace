import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import CourseSelector from './CourseSelector';
import AvailabilityEditor from './AvailabilityEditor';
import DeleteAccountModal from './DeleteAccountModal';

export default function ProfileViewer({ userId, user, onClose, onUserUpdate, onLogout }) {
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [major, setMajor] = useState(user.major || '');
    const [year, setYear] = useState(user.year || '');
    const [bio, setBio] = useState(user.bio || '');
    const [profilePictureUrl, setProfilePictureUrl] = useState(user.profilePictureUrl || '');
    const [studyStyle, setStudyStyle] = useState(user.studyPreferences?.studyStyle || '');
    const [environment, setEnvironment] = useState(user.studyPreferences?.environment || '');
    const [interests, setInterests] = useState(user.interests || []);
    const [github, setGithub] = useState(user.linkedResources?.github || '');
    const [linkedin, setLinkedin] = useState(user.linkedResources?.linkedin || '');
    const [studyGoals, setStudyGoals] = useState(user.studyGoals || []);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    
    // Analytics State
    const [weeklyMinutes, setWeeklyMinutes] = useState(0);
    const [fetchingAnalytics, setFetchingAnalytics] = useState(true);
    const [loggingSession, setLoggingSession] = useState(false);

    const fileInputRef = useRef(null);

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

    const fetchWeeklyAnalytics = async () => {
        try {
            setFetchingAnalytics(true);
            const { startDate, endDate } = getCurrentWeekBounds();
            const res = await axios.get(`/api/analytics/weekly/${userId}`, {
                params: { startDate, endDate }
            });
            setWeeklyMinutes(res.data.totalWeeklyMinutes || 0);
        } catch (err) {
            console.error('Failed to fetch analytics', err);
        } finally {
            setFetchingAnalytics(false);
        }
    };

    const handleMockLogSession = async () => {
        try {
            setLoggingSession(true);
            const end = new Date();
            const start = new Date(end.getTime() - (120 * 60000)); // 2 hours ago
            await axios.post('/api/analytics/session', {
                startTime: start.toISOString(),
                endTime: end.toISOString()
            });
            await fetchWeeklyAnalytics();
        } catch (err) {
            console.error('Failed to log mock session', err);
        } finally {
            setLoggingSession(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchWeeklyAnalytics();
        }
    }, [userId]);

    const handleSaveProfile = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const res = await axios.put(`/api/users/${userId}`, {
                displayName,
                major,
                year,
                bio,
                studyPreferences: { studyStyle, environment },
                interests,
                linkedResources: { github, linkedin },
                studyGoals
            });
            setSuccess(true);
            setEditing(false);
            if (onUserUpdate) {
                onUserUpdate({ ...res.data.user, profilePictureUrl });
            }
        } catch (err) {
            if (err.response?.status === 401) {
                setError('You must be logged in to edit your profile.');
            } else if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to save profile. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setDisplayName(user.displayName || '');
        setMajor(user.major || '');
        setYear(user.year || '');
        setBio(user.bio || '');
        setStudyStyle(user.studyPreferences?.studyStyle || '');
        setEnvironment(user.studyPreferences?.environment || '');
        setInterests(user.interests || []);
        setGithub(user.linkedResources?.github || '');
        setLinkedin(user.linkedResources?.linkedin || '');
        setStudyGoals(user.studyGoals || []);
        setEditing(false);
        setError(null);
    };

    const handleAddTag = (e, setter, array) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = e.target.value.trim();
            if (val && !array.includes(val) && array.length < 10) {
                setter([...array, val]);
            }
            e.target.value = '';
        }
    };
    const handleRemoveTag = (index, setter, array) => {
        setter(array.filter((_, i) => i !== index));
    };

    const handlePictureSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Client-side validation
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Only PNG and JPEG images are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('File size exceeds the 5MB limit.');
            return;
        }

        setUploadingPicture(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('profilePicture', file);
            const res = await axios.put(`/api/users/${userId}/profile-picture`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setProfilePictureUrl(res.data.user.profilePictureUrl);
            if (onUserUpdate) {
                onUserUpdate(res.data.user);
            }
        } catch (err) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to upload profile picture. Please try again.');
            }
        } finally {
            setUploadingPicture(false);
            // Reset file input so the same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemovePicture = async () => {
        setUploadingPicture(true);
        setError(null);
        try {
            const res = await axios.delete(`/api/users/${userId}/profile-picture`);
            setProfilePictureUrl('');
            if (onUserUpdate) {
                onUserUpdate(res.data.user);
            }
        } catch (err) {
            if (err.response?.data?.error) {
                setError(err.response.data.error);
            } else {
                setError('Failed to remove profile picture. Please try again.');
            }
        } finally {
            setUploadingPicture(false);
        }
    };

    const getGradYear = (year) => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        let academicYear;
        if (currentMonth >= 8) {
            academicYear = currentYear + 1;
        } else {
            academicYear = currentYear;
        }
        const yearMap = {
            'Freshman': academicYear + 3,
            'Sophomore': academicYear + 2,
            'Junior': academicYear + 1,
            'Senior': academicYear
        }
        return yearMap[year] || 'N/A';
    };

    const letterAvatar = (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center text-black font-bold text-lg">
            {displayName?.[0] || 'U'}
        </div>
    );

    const avatarImage = profilePictureUrl ? (
        <img
            src={profilePictureUrl}
            alt={`${displayName}'s profile picture`}
            className="w-full h-full rounded-full object-cover"
        />
    ) : letterAvatar;

  return (
    <div className="background-blur" onClick={onClose}>
      <div className="course-selector" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
            My Profile
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors">
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Hidden file input for profile picture */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handlePictureSelect}
        />
        {/* ── Profile Section ── */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            Profile updated successfully!
          </div>
        )}
        <div className="mb-6 p-4 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)]">
          {editing ? (
            /* ── Edit Mode ── */
            <div className="space-y-3">
              {/* Profile picture upload area */}
              <div className="flex items-center gap-4 mb-2">
                <div
                  className="relative w-16 h-16 rounded-full cursor-pointer group flex-shrink-0"
                  onClick={() => !uploadingPicture && fileInputRef.current?.click()}
                >
                  {uploadingPicture ? (
                    <div className="w-full h-full rounded-full bg-[var(--color-surface)] flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
                    </div>
                  ) : (
                    <>
                      {avatarImage}
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
                  >
                    Change Photo
                  </button>
                  {profilePictureUrl && (
                    <button
                      onClick={handleRemovePicture}
                      disabled={uploadingPicture}
                      className="text-xs text-red-400 hover:underline disabled:opacity-50 text-left"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Display Name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={2} placeholder="Tell others about yourself..."
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)] resize-none" />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 text-right">{bio.length}/300</p>
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Major</label>
                <input type="text" value={major} onChange={(e) => setMajor(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Year</label>
                <select value={year} onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" >
                    <option value="">Select Year</option>
                    <option value="Freshman">Freshman</option>
                    <option value="Sophomore">Sophomore</option>
                    <option value="Junior">Junior</option>
                    <option value="Senior">Senior</option>
                    <option value="Graduate">Graduate</option>
                </select>
              </div>

              {/* Study Preferences */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Study Style</label>
                  <select value={studyStyle} onChange={(e) => setStudyStyle(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" >
                      <option value="">Unspecified</option>
                      <option value="solo">Solo</option>
                      <option value="group">Group</option>
                      <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Environment</label>
                  <select value={environment} onChange={(e) => setEnvironment(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" >
                      <option value="">Unspecified</option>
                      <option value="quiet">Quiet</option>
                      <option value="moderate">Moderate</option>
                      <option value="collaborative">Collaborative</option>
                  </select>
                </div>
              </div>

              {/* Interests (Tags) */}
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Interests (Press Enter to add)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {interests.map((tag, i) => (
                    <span key={i} className="px-2 py-1 text-xs bg-[var(--color-purdue-gold)]/10 text-[var(--color-purdue-gold)] rounded flex items-center gap-1">
                      {tag}
                      <button type="button" onClick={() => handleRemoveTag(i, setInterests, interests)} className="hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
                <input type="text" onKeyDown={(e) => handleAddTag(e, setInterests, interests)} placeholder="e.g. AI, Climbing, Chess"
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
              </div>

              {/* Linked Resources */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">GitHub Handle</label>
                  <input type="text" value={github} onChange={(e) => setGithub(e.target.value)} placeholder="username"
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">LinkedIn Profile</label>
                  <input type="text" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} placeholder="in/username"
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
                </div>
              </div>

              {/* Study Goals (Tags) */}
              <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Study Goals (Press Enter to add)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {studyGoals.map((goal, i) => (
                    <span key={i} className="px-2 py-1 text-xs border border-[var(--color-border)] text-[var(--color-text-primary)] rounded flex items-center gap-1">
                      {goal}
                      <button type="button" onClick={() => handleRemoveTag(i, setStudyGoals, studyGoals)} className="hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
                <input type="text" onKeyDown={(e) => handleAddTag(e, setStudyGoals, studyGoals)} placeholder="e.g. Master React, Pass MA261"
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
              </div>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 flex-shrink-0">
                  {avatarImage}
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{displayName}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{major} · Class of {getGradYear(year)}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{user.email}</p>
                </div>
              </div>
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] hover:border-[var(--color-purdue-gold)] transition-colors">
                Edit Profile
              </button>
            </div>
          )}
        </div>
        {/* ── Analytics Widget ── */}
        <div style={{borderTop: '1px solid var(--color-border)', margin: '1.5rem 0'}} />
        <div className="flex items-center justify-between mb-3">
          <h3 style={{fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)'}}>Weekly Study Productivity</h3>
          <button onClick={handleMockLogSession} disabled={loggingSession} className="px-3 py-1 bg-[var(--color-purdue-gold)]/10 text-[var(--color-purdue-gold)] hover:bg-[var(--color-purdue-gold)]/20 border border-[var(--color-purdue-gold)]/30 rounded text-xs font-semibold disabled:opacity-50 transition-colors">
            {loggingSession ? 'Logging...' : '+ Log 2hr Mock Session'}
          </button>
        </div>
        
        <div className="p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl relative overflow-hidden">
           {fetchingAnalytics ? (
               <div className="h-16 flex items-center justify-center animate-pulse"><div className="w-5 h-5 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" /></div>
           ) : (
               <>
                   <div className="flex justify-between items-end mb-2 relative z-10">
                       <div>
                           <p className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
                               {Math.floor(weeklyMinutes / 60)}<span className="text-lg opacity-70">h</span> {weeklyMinutes % 60}<span className="text-lg opacity-70">m</span>
                           </p>
                           <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest mt-1">Total Logic Recorded This Week</p>
                       </div>
                       <div className="text-right">
                           <p className="text-sm font-semibold text-[var(--color-purdue-gold)]">{Math.min(100, Math.round((weeklyMinutes / 600) * 100))}% Goal</p>
                       </div>
                   </div>
                   <div className="w-full h-2.5 bg-[var(--color-surface)] rounded-full mt-3 overflow-hidden relative z-10">
                       <div className="h-full bg-[var(--color-purdue-gold)] transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_var(--color-purdue-gold)]" style={{ width: `${Math.min(100, (weeklyMinutes / 600) * 100)}%` }} />
                   </div>
               </>
           )}
        </div>

        {/* ── Divider ── */}
        <div style={{borderTop: '1px solid var(--color-border)', margin: '1.5rem 0'}} />
        <h3 style={{fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.75rem'}}>My Courses</h3>
        {/* ── Course Selector Section (existing component) ── */}
        <CourseSelector userId={userId} embedded={true} />

        {/* - Divider - */}
        <div style={{borderTop: '1px solid var(--color-border)', margin: '1.5rem 0'}} />
        <h3 style={{fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.75rem'}}>Study Availability</h3>
        <AvailabilityEditor />

        <div style={{borderTop: '1px solid var(--color-border)', margin: '1.5rem 0'}} />
        <h3 style={{fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.75rem'}}>Danger Zone</h3>
        <button
          id="delete-account-button"
          onClick={() => setShowDeleteModal(true)}
          className="w-full py-2.5 rounded-lg border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/10 transition-colors"
        >
          Delete Account
        </button>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          userEmail={user.email}
          onDeleted={() => {
            setShowDeleteModal(false);
            onClose();
            if (onLogout) onLogout();
          }}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}
