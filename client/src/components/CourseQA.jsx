import { useState } from 'react';
import axios from 'axios';

export default function CourseQA({ courseId, courseName, onClose }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAskQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError('Please enter a question.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer('');

    try {
      const response = await axios.post(`/api/courses/${courseId}/qa`, {
        question: trimmedQuestion,
      });
      setAnswer(response.data.answer || '');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to answer question');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="background-blur" onClick={onClose}>
      <div className="course-selector" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">AI Course Q&amp;A</h2>
            {courseName && <p className="text-sm text-[var(--color-text-secondary)]">{courseName}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close AI course Q&A"
            className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">Ask a question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What is the main idea behind recurrence relations?"
              rows={4}
              className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]/50 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAskQuestion}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Thinking...' : 'Ask AI'}
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {(answer || loading) && (
            <div className="p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)]">
              {loading ? (
                <p className="text-sm text-[var(--color-text-secondary)]">Searching your notes...</p>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-purdue-gold)] mb-2">Answer</p>
                  <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">{answer}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}