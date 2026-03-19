import { useState } from 'react';
import axios from 'axios';

export default function PracticeQuestions({ courseId, courseName, onClose }) {
  const [questions, setQuestions] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('mixed');
  const [focus, setFocus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setQuestions([]);
    setRevealed({});

    try {
      const response = await axios.post(`/api/courses/${courseId}/practice-questions`, {
        count,
        difficulty,
        focus,
      });
      setQuestions(response.data.questions || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate practice questions');
    } finally {
      setLoading(false);
    }
  };

  const toggleReveal = (id) => {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="background-blur" onClick={onClose}>
      <div className="course-selector" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">AI Practice Questions</h2>
            {courseName && <p className="text-sm text-[var(--color-text-secondary)]">{courseName}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close practice questions"
            className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!loading && questions.length === 0 && (
          <div className="flex flex-col gap-4 p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="text-xs text-[var(--color-text-secondary)]">
                Number of Questions
                <select
                  className="mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)]"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                >
                  {[3, 5, 7, 10].map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-[var(--color-text-secondary)]">
                Difficulty
                <select
                  className="mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)]"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>

              <label className="text-xs text-[var(--color-text-secondary)]">
                Focus (optional)
                <input
                  type="text"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  placeholder="e.g. recursion, sorting"
                  className="mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-2 text-sm text-[var(--color-text-primary)]"
                />
              </label>
            </div>

            <button
              onClick={handleGenerate}
              className="self-center px-5 py-2.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              Generate Practice Questions
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Generating questions...</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && questions.length > 0 && (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {questions.map((item, index) => {
              const isRevealed = Boolean(revealed[item.id]);
              return (
                <div key={item.id} className="p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)]">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {index + 1}. {item.question}
                  </p>

                  {!isRevealed && (
                    <button
                      onClick={() => toggleReveal(item.id)}
                      className="mt-3 px-3 py-1.5 text-xs font-semibold border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors"
                    >
                      Reveal Answer
                    </button>
                  )}

                  {isRevealed && (
                    <div className="mt-3 p-3 rounded-md border border-[var(--color-purdue-gold)]/40 bg-[var(--color-surface)]">
                      <p className="text-xs font-semibold text-[var(--color-purdue-gold)] mb-1">Explanation</p>
                      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{item.answer}</p>
                      <button
                        onClick={() => toggleReveal(item.id)}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] transition-colors"
                      >
                        Hide Answer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleGenerate}
              className="self-center mt-2 px-4 py-2 text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors"
            >
              Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
