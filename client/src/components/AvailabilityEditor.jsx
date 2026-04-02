import { useState, useEffect } from 'react';
import axios from 'axios';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

export default function AvailabilityEditor() {
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);

    useEffect(() => {
        axios.get('/api/users/me/availability')
            .then((res) => setSlots(res.data || []))
            .catch(() => setError('Failed to load availability'))
            .finally(() => setLoading(false));
    }, []);

    const addSlot = (day) => {
        setSlots((prev) => [...prev, { day, startTime: '09:00', endTime: '17:00' }]);
        setSuccess(false);
        setValidationErrors([]);
    };

    const removeSlot = (index) => {
        setSlots((prev) => prev.filter((_, i) => i !== index));
        setSuccess(false);
        setValidationErrors([]);
    };

    const updateSlot = (index, field, value) => {
        setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
        setSuccess(false);
        setValidationErrors([]);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccess(false);
        setValidationErrors([]);
        try {
            const res = await axios.put('/api/users/me/availability', { availability: slots });
            setSlots(res.data.availability);
            setSuccess(true);
        } catch (err) {
            if (err.response?.status === 400 && err.response.data.details) {
                setValidationErrors(err.response.data.details);
            } else {
                setError(err.response?.data?.error || 'Failed to save availability');
            }
        } finally {
            setSaving(false);
        }
    };

    const getSlotsForDay = (day) => {
        const result = [];
        slots.forEach((s, i) => {
            if (s.day === day) result.push({ ...s, _index: i });
        });
        return result;
    };

    if (loading) {
        return (
            <div className="text-center py-6 text-sm text-[var(--color-text-secondary)]">
                Loading availability...
            </div>
        );
    }

    return (
        <div>
            {error && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                    Availability saved!
                </div>
            )}
            {validationErrors.length > 0 && (
                <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm">
                    <p className="text-red-400 font-medium mb-1">Please fix the following:</p>
                    <ul className="list-disc list-inside text-red-300 space-y-0.5">
                        {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                </div>
            )}

            <div className="space-y-3">
                {DAYS.map((day) => {
                    const daySlots = getSlotsForDay(day);
                    return (
                        <div key={day} className="p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)]">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                    {DAY_SHORT[day]}
                                </span>
                                <button
                                    onClick={() => addSlot(day)}
                                    className="text-xs text-[var(--color-purdue-gold)] hover:underline"
                                    aria-label={`Add time slot for ${day}`}
                                >
                                    + Add slot
                                </button>
                            </div>

                            {daySlots.length === 0 ? (
                                <p className="text-xs text-[var(--color-text-secondary)] italic">
                                    No time slots
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {daySlots.map((slot) => (
                                        <div key={slot._index} className="flex items-center gap-2">
                                            <input
                                                type="time"
                                                value={slot.startTime}
                                                onChange={(e) => updateSlot(slot._index, 'startTime', e.target.value)}
                                                className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                                                aria-label={`Start time for ${day}`}
                                            />
                                            <span className="text-xs text-[var(--color-text-secondary)]">to</span>
                                            <input
                                                type="time"
                                                value={slot.endTime}
                                                onChange={(e) => updateSlot(slot._index, 'endTime', e.target.value)}
                                                className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                                                aria-label={`End time for ${day}`}
                                            />
                                            <button
                                                onClick={() => removeSlot(slot._index)}
                                                className="text-red-400 hover:text-red-300 text-xs p-1"
                                                aria-label={`Remove time slot for ${day}`}
                                                title="Remove slot"
                                            >
                                                x
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="mt-4 w-full py-2.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                {saving ? 'Saving...' : 'Save Availability'}
            </button>
        </div>
    );
}
