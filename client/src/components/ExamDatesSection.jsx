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

  const now = Date.now();
  const upcoming = exams.filter((exam) => new Date(exam.date).getTime() >= now);

  return (
    <div className="mb-6 p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Upcoming Exams
        </h3>
      </div>

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
