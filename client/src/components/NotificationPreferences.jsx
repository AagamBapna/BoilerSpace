import { useState } from 'react';
import axios from 'axios';

const PREFERENCES = [
    { key: 'sessionReminders', label: 'Session Reminders', description: 'Get notified about upcoming study sessions you joined' },
    { key: 'messages', label: 'Messages', description: 'Receive alerts for new direct messages' },
    { key: 'events', label: 'Events', description: 'Get notified about event updates and changes' },
    { key: 'organizationUpdates', label: 'Organization Updates', description: 'Receive updates from clubs and organizations' },
];

export default function NotificationPreferences({ userId, user, onUserUpdate }) {
    const settings = user.notificationSettings || {};
    const [prefs, setPrefs] = useState({
        sessionReminders: settings.sessionReminders ?? true,
        messages: settings.messages ?? true,
        events: settings.events ?? true,
        organizationUpdates: settings.organizationUpdates ?? true,
        globalMute: settings.globalMute ?? false,
    });
    const [saving, setSaving] = useState(null);
    const [error, setError] = useState(null);
    const [muteDuration, setMuteDuration] = useState('30');

    const handleToggle = async (key) => {
        const newValue = !prefs[key];
        const oldPrefs = { ...prefs };
        const updated = { ...prefs, [key]: newValue };
        setPrefs(updated);
        setSaving(key);
        setError(null);

        try {
            const res = await axios.put(`/api/users/${userId}/notifications/preferences`, {
                [key]: newValue,
            });
            if (onUserUpdate) {
                onUserUpdate({ ...user, notificationSettings: res.data.notificationSettings });
            }
        } catch (err) {
            setPrefs(oldPrefs);
            setError(err.response?.data?.error || 'Failed to update preference');
        } finally {
            setSaving(null);
        }
    };

    const isGlobalMuted = prefs.globalMute;

    return (
        <div>
            {error && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Focus Mode */}
            <div className="mb-4 p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">🔕 Focus Mode</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                            {prefs.globalMute
                                ? `Active${settings.muteExpiresAt ? ` — expires ${new Date(settings.muteExpiresAt).toLocaleTimeString()}` : ' — indefinite'}`
                                : 'Temporarily silence all alerts'}
                        </p>
                    </div>
                    {prefs.globalMute ? (
                        <button
                            onClick={async () => {
                                const oldPrefs = { ...prefs };
                                setPrefs({ ...prefs, globalMute: false });
                                setSaving('globalMute');
                                try {
                                    const res = await axios.put(`/api/users/${userId}/notifications/preferences`, {
                                        globalMute: false,
                                        muteExpiresAt: null,
                                    });
                                    if (onUserUpdate) onUserUpdate({ ...user, notificationSettings: res.data.notificationSettings });
                                } catch (err) {
                                    setPrefs(oldPrefs);
                                    setError(err.response?.data?.error || 'Failed to update');
                                } finally {
                                    setSaving(null);
                                }
                            }}
                            disabled={saving === 'globalMute'}
                            className="px-3 py-1.5 text-xs font-semibold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
                        >
                            Deactivate
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <select
                                value={muteDuration}
                                onChange={(e) => setMuteDuration(e.target.value)}
                                className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)]"
                            >
                                <option value="30">30 min</option>
                                <option value="60">1 hour</option>
                                <option value="120">2 hours</option>
                                <option value="0">Until I turn off</option>
                            </select>
                            <button
                                onClick={async () => {
                                    const minutes = parseInt(muteDuration);
                                    const muteExpiresAt = minutes > 0 ? new Date(Date.now() + minutes * 60000).toISOString() : null;
                                    const oldPrefs = { ...prefs };
                                    setPrefs({ ...prefs, globalMute: true });
                                    setSaving('globalMute');
                                    try {
                                        const res = await axios.put(`/api/users/${userId}/notifications/preferences`, {
                                            globalMute: true,
                                            muteExpiresAt,
                                        });
                                        if (onUserUpdate) onUserUpdate({ ...user, notificationSettings: res.data.notificationSettings });
                                    } catch (err) {
                                        setPrefs(oldPrefs);
                                        setError(err.response?.data?.error || 'Failed to activate');
                                    } finally {
                                        setSaving(null);
                                    }
                                }}
                                disabled={saving === 'globalMute'}
                                className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black rounded-lg hover:opacity-90 transition-opacity"
                            >
                                Activate
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Individual Preference Toggles */}
            <div className="space-y-2">
                {PREFERENCES.map(({ key, label, description }) => (
                    <div
                        key={key}
                        className={`p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] ${
                            isGlobalMuted ? 'opacity-50' : ''
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
                                <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
                            </div>
                            <button
                                onClick={() => handleToggle(key)}
                                disabled={isGlobalMuted || saving === key}
                                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                    prefs[key] && !isGlobalMuted
                                        ? 'bg-[var(--color-purdue-gold)]'
                                        : 'bg-[var(--color-border)]'
                                } ${(isGlobalMuted || saving === key) ? 'cursor-not-allowed' : ''}`}
                                role="switch"
                                aria-checked={prefs[key] && !isGlobalMuted}
                                aria-label={label}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                                    prefs[key] && !isGlobalMuted ? 'translate-x-5' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
