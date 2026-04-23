import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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

// Top-bar button that always shows the user's current weekly study total.
// Clicking opens the StudyTimeWidget modal. `refreshKey` lets the parent force
// a refetch (e.g. when the modal closes after a session log).
export default function StudyTimePill({ userId, refreshKey, onClick }) {
  const [weeklyMinutes, setWeeklyMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

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
      console.error('Failed to fetch weekly study total', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchWeekly();
  }, [fetchWeekly, refreshKey]);

  // Keep the pill in sync if the user comes back to the tab after studying elsewhere
  useEffect(() => {
    const onFocus = () => fetchWeekly();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchWeekly]);

  const hours = Math.floor(weeklyMinutes / 60);
  const minutes = weeklyMinutes % 60;

  return (
    <button
      type="button"
      onClick={onClick}
      title="View and log your weekly study time"
      className="profile-button-like"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{loading ? 'Study Time' : `${hours}h ${minutes}m this week`}</span>
    </button>
  );
}
