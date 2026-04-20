import { useState, useEffect } from 'react';
import axios from 'axios';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function formatExamDate(dateStr) {
  return new Date(dateStr).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ExamDatesSection({ courseId }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    axios
      .get(`/api/courses/${courseId}/exams`)
      .then((res) => setExams(res.data))
      .catch((err) => {
        console.error('Failed to fetch exams:', err);
        setError('Failed to load exams.');
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  const resetForm = () => {
    setTitle('');
    setDate('');
    setLocation('');
    setFormError(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Exam title is required.');
      return;
    }
    if (!date) {
      setFormError('Exam date is required.');
      return;
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      setFormError('Exam date is invalid.');
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      setFormError('Exam date must be in the future.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`/api/courses/${courseId}/exams`, {
        title: trimmedTitle,
        date: parsed.toISOString(),
        location: location.trim(),
      });
      setExams(res.data);
      setFormSuccess('Exam added.');
      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error('Failed to add exam:', err);
      setFormError(err.response?.data?.error || 'Failed to add exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const now = Date.now();
  const upcoming = exams.filter((exam) => new Date(exam.date).getTime() >= now);

  return (
    <div className="mb-6 p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Upcoming Exams
        </h3>
        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setFormSuccess(null);
            }}
            className="py-1 px-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
          >
            + Add Exam
          </button>
        )}
      </div>

      {formSuccess && !showForm && (
        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-xs">
          {formSuccess}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-3 p-3 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] flex flex-col gap-2"
        >
          <input
            type="text"
            placeholder="Exam title (e.g. Midterm 1)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="px-3 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
            aria-label="Exam title"
          />
          <input
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
            aria-label="Exam date and time"
          />
          <input
            type="text"
            placeholder="Location (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="px-3 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
            aria-label="Exam location"
          />
          {formError && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
              {formError}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="py-1 px-3 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-1 px-3 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Saving...' : 'Save Exam'}
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-3">
          <div className="w-4 h-4 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
          <p className="text-xs text-[var(--color-text-secondary)]">Loading exams...</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && upcoming.length === 0 && (
        <p className="text-xs text-[var(--color-text-secondary)] py-2">
          No upcoming exams listed for this course.
        </p>
      )}

      {!loading && !error && upcoming.length > 0 && (
        <ul className="flex flex-col gap-2">
          {upcoming.map((exam) => {
            const examTime = new Date(exam.date).getTime();
            const isThisWeek = examTime - now <= ONE_WEEK_MS;
            return (
              <li
                key={exam._id}
                data-testid={isThisWeek ? 'exam-priority' : 'exam-upcoming'}
                className={`p-3 rounded-lg border ${
                  isThisWeek
                    ? 'bg-[var(--color-purdue-gold)]/10 border-[var(--color-purdue-gold)]/40'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                        {exam.title}
                      </p>
                      {isThisWeek && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[var(--color-purdue-gold)] text-black">
                          This week
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {formatExamDate(exam.date)}
                    </p>
                    {exam.location && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        {exam.location}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
