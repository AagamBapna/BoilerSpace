import { useState, useRef } from 'react';
import axios from 'axios';
import CourseSelector from './CourseSelector';
import AvailabilityEditor from './AvailabilityEditor';
import DeleteAccountModal from './DeleteAccountModal';

export default function ProfileViewer({ userId, user, onClose, onUserUpdate, onLogout }) {
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [major, setMajor] = useState(user.major || '');
    const [year, setYear] = useState(user.year || '');
    const [profilePictureUrl, setProfilePictureUrl] = useState(user.profilePictureUrl || '');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingPicture, setUploadingPicture] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const fileInputRef = useRef(null);

    const handleSaveProfile = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            const res = await axios.put(`/api/users/${userId}`, {
                displayName,
                major,
                year,
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
        setEditing(false);
        setError(null);
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
                </select>
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
