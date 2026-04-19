import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Returns ISO bounds for the user's current local week: Monday 00:00 -> Sunday 23:59:59.999
function getCurrentWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diffToMonday));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { startDate: monday.toISOString(), endDate: sunday.toISOString() };
}

// Format Date as the local "YYYY-MM-DDTHH:MM" string consumed by <input type="datetime-local" />
function toDatetimeLocalString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function StudyTimeWidget({ userId, user, onClose, onUserUpdate, onSessionLogged }) {
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Log-session form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [logHours, setLogHours] = useState('1');
  const [logMinutes, setLogMinutes] = useState('0');
  const [logEndDateTime, setLogEndDateTime] = useState('');
  const [logging, setLogging] = useState(false);

  // Goal editor state — initialized from prop, kept in sync via effect below.
  const initialGoal = Number.isFinite(user?.weeklyStudyGoalMinutes) ? user.weeklyStudyGoalMinutes : 600;
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalHours, setGoalHours] = useState(String(Math.floor(initialGoal / 60)));
  const [goalMinutes, setGoalMinutes] = useState(String(initialGoal % 60));
  const [goalMinutesValue, setGoalMinutesValue] = useState(initialGoal);
  const [savingGoal, setSavingGoal] = useState(false);

  // If the parent passes in a freshly-fetched user (e.g. on mount or after a refetch),
  // mirror its persisted goal here so we never display stale state.
  useEffect(() => {
    if (Number.isFinite(user?.weeklyStudyGoalMinutes)) {
      setGoalMinutesValue(user.weeklyStudyGoalMinutes);
      if (!editingGoal) {
        setGoalHours(String(Math.floor(user.weeklyStudyGoalMinutes / 60)));
        setGoalMinutes(String(user.weeklyStudyGoalMinutes % 60));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.weeklyStudyGoalMinutes]);

  const fetchWeekly = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const { startDate, endDate } = getCurrentWeekBounds();
      const res = await axios.get(`/api/analytics/weekly/${userId}`, {
        params: { startDate, endDate },
      });
      setWeeklyMinutes(res.data.totalWeeklyMinutes || 0);
    } catch (err) {
      console.error('Failed to fetch weekly analytics', err);
      setError(err.response?.data?.error || 'Failed to load weekly analytics.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWeekly();
  }, [fetchWeekly]);

  const handleLogSession = async () => {
    setError(null);
    setSuccess(null);

    const hours = parseInt(logHours, 10) || 0;
    const minutes = parseInt(logMinutes, 10) || 0;
    const totalMinutes = hours * 60 + minutes;

    if (totalMinutes < 1) {
      setError('Please enter at least 1 minute of study time.');
      return;
    }
    if (totalMinutes > 1440) {
      setError('A single session cannot exceed 24 hours (1440 minutes).');
      return;
    }

    const now = new Date();
    const end = logEndDateTime ? new Date(logEndDateTime) : now;
    if (Number.isNaN(end.getTime())) {
      setError('Invalid end time provided.');
      return;
    }
    // Block future-dated sessions on the client too (with 60s skew tolerance to match the backend).
    if (end.getTime() > now.getTime() + 60 * 1000) {
      setError('End time cannot be in the future.');
      return;
    }
    const start = new Date(end.getTime() - totalMinutes * 60000);

    try {
      setLogging(true);
      await axios.post('/api/analytics/session', {
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      setSuccess(`Logged ${hours}h ${minutes}m of study time.`);
      setShowLogForm(false);
      setLogHours('1');
      setLogMinutes('0');
      setLogEndDateTime('');
      await fetchWeekly();
      if (onSessionLogged) onSessionLogged();
    } catch (err) {
      console.error('Failed to log study session', err);
      setError(err.response?.data?.error || 'Failed to log study session. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  const handleSaveGoal = async () => {
    setError(null);
    setSuccess(null);

    const hours = parseInt(goalHours, 10) || 0;
    const minutes = parseInt(goalMinutes, 10) || 0;
    const total = hours * 60 + minutes;

    if (total < 0 || total > 10080) {
      setError('Weekly goal must be between 0 minutes and 168 hours.');
      return;
    }

    try {
      setSavingGoal(true);
      const putRes = await axios.put(`/api/users/${userId}`, {
        weeklyStudyGoalMinutes: total,
      });
      // Read back from /api/auth/me as the source of truth so we surface the
      // value that's actually persisted in the database (not just an optimistic copy).
      let persistedGoal = putRes.data?.user?.weeklyStudyGoalMinutes;
      let freshUser = null;
      try {
        const meRes = await axios.get('/api/auth/me');
        freshUser = meRes.data;
        if (Number.isFinite(freshUser?.weeklyStudyGoalMinutes)) {
          persistedGoal = freshUser.weeklyStudyGoalMinutes;
        }
      } catch (e) {
        // If the verification fetch fails for any reason, fall back to the PUT response.
        console.warn('Could not verify persisted goal via /api/auth/me', e);
      }

      const finalGoal = Number.isFinite(persistedGoal) ? persistedGoal : total;
      setGoalMinutesValue(finalGoal);
      setGoalHours(String(Math.floor(finalGoal / 60)));
      setGoalMinutes(String(finalGoal % 60));
      setEditingGoal(false);
      setSuccess(
        finalGoal === total
          ? 'Weekly goal saved.'
          : `Saved, but server returned ${finalGoal} min instead of ${total} min.`
      );
      if (onUserUpdate) {
        onUserUpdate(freshUser ? { ...freshUser } : { weeklyStudyGoalMinutes: finalGoal });
      }
    } catch (err) {
      console.error('Failed to save weekly goal', err);
      setError(err.response?.data?.error || 'Failed to save weekly goal.');
    } finally {
      setSavingGoal(false);
    }
  };

  const goalProgressPct = goalMinutesValue > 0
    ? Math.min(100, Math.round((weeklyMinutes / goalMinutesValue) * 100))
    : 0;

  // datetime-local "max" attribute prevents picking a future date in the picker
  const nowLocalMax = toDatetimeLocalString(new Date());

  return (
    <div className="background-blur" onClick={onClose}>
      <div
        className="course-selector"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Study Time</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-xs">
            {success}
          </div>
        )}

        {/* Weekly total card */}
        <div className="p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl relative overflow-hidden">
          {loading ? (
            <div className="h-16 flex items-center justify-center animate-pulse">
              <div className="w-5 h-5 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex justify-between items-end mb-2 relative z-10">
                <div>
                  <p className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
                    {Math.floor(weeklyMinutes / 60)}<span className="text-lg opacity-70">h</span> {weeklyMinutes % 60}<span className="text-lg opacity-70">m</span>
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest mt-1">
                    Total Study Time This Week
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--color-purdue-gold)]">
                    {goalMinutesValue > 0 ? `${goalProgressPct}% of Goal` : 'No goal set'}
                  </p>
                </div>
              </div>
              <div className="w-full h-2.5 bg-black/20 rounded-full mt-3 overflow-hidden relative z-10 border border-[var(--color-border)]">
                <div
                  className="h-full bg-[var(--color-purdue-gold)] transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_var(--color-purdue-gold)]"
                  style={{ width: `${goalProgressPct}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Weekly goal editor */}
        <div className="mt-4 p-4 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Weekly Study Goal</p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Currently {Math.floor(goalMinutesValue / 60)}h {goalMinutesValue % 60}m per week
              </p>
            </div>
            {!editingGoal && (
              <button
                onClick={() => {
                  setGoalHours(String(Math.floor(goalMinutesValue / 60)));
                  setGoalMinutes(String(goalMinutesValue % 60));
                  setEditingGoal(true);
                }}
                className="px-3 py-1 border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] hover:border-[var(--color-purdue-gold)] transition-colors"
              >
                Edit
              </button>
            )}
          </div>
          {editingGoal && (
            <div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Hours</label>
                  <input
                    type="number"
                    min="0"
                    max="168"
                    value={goalHours}
                    onChange={(e) => setGoalHours(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={goalMinutes}
                    onChange={(e) => setGoalMinutes(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingGoal(false)}
                  className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGoal}
                  disabled={savingGoal}
                  className="px-4 py-1.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {savingGoal ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Manual log form */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Add Study Time</p>
            <button
              onClick={() => {
                setShowLogForm((v) => !v);
                setError(null);
                setSuccess(null);
              }}
              className="px-3 py-1 bg-[var(--color-purdue-gold)]/10 text-[var(--color-purdue-gold)] hover:bg-[var(--color-purdue-gold)]/20 border border-[var(--color-purdue-gold)]/30 rounded text-xs font-semibold transition-colors"
            >
              {showLogForm ? 'Cancel' : '+ Log Session'}
            </button>
          </div>
          {showLogForm && (
            <div className="p-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl">
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                Log study time the system didn't track automatically. Future end times are not allowed.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Hours</label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Minutes</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                  Ended at (leave blank for now)
                </label>
                <input
                  type="datetime-local"
                  value={logEndDateTime}
                  max={nowLocalMax}
                  onChange={(e) => setLogEndDateTime(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleLogSession}
                  disabled={logging}
                  className="px-4 py-2 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-xs hover:opacity-90 disabled:opacity-50"
                >
                  {logging ? 'Logging...' : 'Log Session'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
