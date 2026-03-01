import { useState, useEffect } from 'react';
import axios from 'axios';
import CourseSelector from './CourseSelector';

export default function ProfileViewer({ userId, user, onClose, onUserUpdate }) {
    const [editing, setEditing] = useState(false);
    const [displayName, setDisplayName] = useState(user.displayName || '');
    const [major, setMajor] = useState(user.major || '');
    const [year, setYear] = useState(user.year || '');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [saving, setSaving] = useState(false);


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
                onUserUpdate(res.data.user);
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

  return (
    <div className="background-blur">
      <div className="course-selector">
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
                <input type="text" value={year} onChange={(e) => setYear(e.target.value)}
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
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center text-black font-bold text-lg">
                  {displayName?.[0] || 'U'}
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text-primary)]">{displayName}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{major} · Class of {year}</p>
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
        <div className="border-t border-[var(--color-border)] mb-6" />
        {/* ── Course Selector Section (existing component) ── */}
        <CourseSelector userId={userId} embedded={true} />
      </div>
    </div>
  );
}
