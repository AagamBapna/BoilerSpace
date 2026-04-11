import { useState } from 'react';
import axios from 'axios';

export default function CourseQA({ courseId, courseName, onClose }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [askedQuestion, setAskedQuestion] = useState('');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkError, setBookmarkError] = useState(null);

  const getErrorMessage = (error) => {
    const backendError = error.response?.data?.error || '';
    const statusCode = error.response?.status;

    // Specific error type handling
    if (backendError.includes('No PDF notes found')) {
      return 'No course notes available for this course. Please ensure study materials have been uploaded.';
    }
    if (backendError.includes('AI model not configured')) {
      return 'AI service is currently unavailable. Please try again later.';
    }
    if (backendError.includes('AI returned an empty answer')) {
      return 'Could not generate an answer. Try rephrasing your question or check if course materials cover this topic.';
    }
    if (backendError.includes('question is required')) {
      return 'Please enter a valid question.';
    }
    if (statusCode === 404) {
      return 'Course not found or no materials available.';
    }
    if (statusCode === 500 || statusCode === 502) {
      return 'AI service encountered an error. Please try again in a moment.';
    }

    // Generic fallback
    return backendError || 'Unable to answer question. Please try again.';
  };

  const handleAskQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError('Please enter a question.');
      return;
    }

    setLoading(true);
    setError(null);
    setAnswer('');
    setAskedQuestion('');
    setIsBookmarked(false);
    setBookmarkError(null);

    try {
      const response = await axios.post(`/api/courses/${courseId}/qa`, {
        question: trimmedQuestion,
      });
      setAnswer(response.data.answer || '');
      setAskedQuestion(trimmedQuestion);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleBookmark = async () => {
    if (!answer || !askedQuestion || isBookmarked || bookmarkLoading) return;

    setBookmarkLoading(true);
    setBookmarkError(null);

    try {
      await axios.post('/api/users/bookmarks/ai', {
        promptString: askedQuestion,
        aiResponseText: answer,
        courseId,
      });
      setIsBookmarked(true);
    } catch (err) {
      setBookmarkError(err.response?.data?.error || 'Failed to save bookmark');
    } finally {
      setBookmarkLoading(false);
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-purdue-gold)]">Answer</p>
                    <button
                      onClick={handleBookmark}
                      disabled={isBookmarked || bookmarkLoading}
                      aria-label={isBookmarked ? 'Bookmarked' : 'Bookmark this response'}
                      title={isBookmarked ? 'Saved to your bookmarks' : 'Bookmark this response'}
                      className="p-1.5 rounded-md hover:bg-[var(--color-surface)] transition-colors disabled:cursor-default"
                    >
                      <svg
                        className={`w-5 h-5 transition-colors ${isBookmarked ? 'text-[var(--color-purdue-gold)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-purdue-gold)]'}`}
                        fill={isBookmarked ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">{answer}</p>
                  {bookmarkError && (
                    <p className="mt-2 text-xs text-red-400">{bookmarkError}</p>
                  )}
                  {isBookmarked && !bookmarkError && (
                    <p className="mt-2 text-xs text-[var(--color-purdue-gold)]">Saved to your bookmarks</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
