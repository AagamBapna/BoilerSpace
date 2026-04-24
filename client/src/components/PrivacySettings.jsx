import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const FIELD_LABELS = {
    email: 'Email address',
    major: 'Major',
    year: 'Year',
    bio: 'Bio',
    studyPreferences: 'Study preferences',
    interests: 'Interests',
    linkedResources: 'GitHub / LinkedIn',
    studyGoals: 'Study goals',
    courses: 'Courses',
    availability: 'Study availability',
    weeklyStudyGoalMinutes: 'Weekly study goal',
};

const FIELD_ORDER = [
    'email', 'major', 'year', 'bio',
    'studyPreferences', 'interests', 'linkedResources', 'studyGoals',
    'courses', 'availability', 'weeklyStudyGoalMinutes',
];

// Toggle row.
function Toggle({ value, onClick, disabled, label, hint }) {
    const isPublic = value === 'public';
    return (
        <div className="flex items-center justify-between py-2">
            <div className="flex-1 pr-3">
                <p className="text-sm text-[var(--color-text-primary)]">{label}</p>
                {hint && <p className="text-xs text-[var(--color-text-secondary)]">{hint}</p>}
            </div>
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                aria-pressed={isPublic}
                aria-label={`${label}: ${isPublic ? 'public' : 'private'}`}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                    isPublic ? 'bg-[var(--color-purdue-gold)]' : 'bg-gray-500/40'
                }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            </button>
        </div>
    );
}

export default function PrivacySettings({ user, onUpdate }) {
    const [profileVisibility, setProfileVisibility] = useState(user?.profileVisibility || 'public');
    const [fieldVisibility, setFieldVisibility] = useState(() => ({ ...(user?.fieldVisibility || {}) }));
    const [loading, setLoading] = useState(!user?.fieldVisibility);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [saving, setSaving] = useState(null);

    // Fetch if not provided.
    useEffect(() => {
        if (user?.fieldVisibility) return;
        setLoading(true);
        axios
            .get('/api/users/me/visibility')
            .then((res) => {
                setProfileVisibility(res.data.profileVisibility || 'public');
                setFieldVisibility(res.data.fieldVisibility || {});
            })
            .catch(() => setError('Failed to load privacy settings.'))
            .finally(() => setLoading(false));
    }, [user?.fieldVisibility]);

    const flashSuccess = useCallback(() => {
        setSuccess('Saved');
        const t = setTimeout(() => setSuccess(null), 1500);
        return () => clearTimeout(t);
    }, []);

    const handleMasterToggle = async () => {
        const prev = profileVisibility;
        const next = prev === 'public' ? 'private' : 'public';
        setProfileVisibility(next);
        setSaving('master');
        setError(null);
        try {
            const res = await axios.put('/api/users/me/visibility', { profileVisibility: next });
            setProfileVisibility(res.data.profileVisibility);
            setFieldVisibility(res.data.fieldVisibility || {});
            onUpdate?.({
                profileVisibility: res.data.profileVisibility,
                fieldVisibility: res.data.fieldVisibility,
            });
            flashSuccess();
        } catch (err) {
            setProfileVisibility(prev);
            setError(err.response?.data?.error || 'Failed to update profile visibility.');
        } finally {
            setSaving(null);
        }
    };

    const handleFieldToggle = async (field) => {
        const prev = fieldVisibility[field] || 'public';
        const next = prev === 'public' ? 'private' : 'public';
        setFieldVisibility((p) => ({ ...p, [field]: next }));
        setSaving(field);
        setError(null);
        try {
            const res = await axios.put('/api/users/me/visibility', {
                fieldVisibility: { [field]: next },
            });
            setFieldVisibility(res.data.fieldVisibility || {});
            onUpdate?.({
                profileVisibility: res.data.profileVisibility,
                fieldVisibility: res.data.fieldVisibility,
            });
            flashSuccess();
        } catch (err) {
            setFieldVisibility((p) => ({ ...p, [field]: prev }));
            setError(err.response?.data?.error || 'Failed to update field visibility.');
        } finally {
            setSaving(null);
        }
    };

    const masterPrivate = profileVisibility === 'private';

    return (
        <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)]">
            {loading && (
                <p className="text-xs text-[var(--color-text-secondary)]">Loading…</p>
            )}
            {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
            {success && <p className="mb-2 text-xs text-green-400">{success}</p>}

            {!loading && (
                <>
                    <Toggle
                        value={masterPrivate ? 'private' : 'public'}
                        onClick={handleMasterToggle}
                        disabled={saving === 'master'}
                        label={masterPrivate ? 'Profile is Private' : 'Profile is Public'}
                        hint={
                            masterPrivate
                                ? 'Only accepted friends see your profile. Hidden from classmate search.'
                                : 'Classmates can find you. Control individual fields below.'
                        }
                    />

                    {!masterPrivate && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                            <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                                Per-field visibility (non-friends)
                            </p>
                            {FIELD_ORDER.map((field) => (
                                <Toggle
                                    key={field}
                                    value={fieldVisibility[field] || 'public'}
                                    onClick={() => handleFieldToggle(field)}
                                    disabled={saving === field}
                                    label={FIELD_LABELS[field]}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
