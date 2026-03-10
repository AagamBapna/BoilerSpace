import { useState } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function StudyGuide({ courseId, courseName, onClose }) {
    const [studyGuide, setStudyGuide] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleGenerateStudyGuide = async () => {
        setError(null);
        setStudyGuide(null);
        setLoading(true);
        try {
            const response = await axios.post(`/api/courses/${courseId}/study-guide`);
            setStudyGuide(response.data.studyGuide);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate study guide');
        } finally {
            setLoading(false);
        }
    };

    return (
      <div className="background-blur" onClick={onClose}>
        <div className="course-selector" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                🤖 AI Study Guide
                </h2>
                {courseName && (
                <p className="text-sm text-[var(--color-text-secondary)]">
                    {courseName}
                </p>
                )}
            </div>
            <button
                onClick={onClose}
                aria-label="Close study guide"
                className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
            >
                <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
            </div>
            {/* Generate button */}
            {!studyGuide && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
                <svg className="w-12 h-12 text-[var(--color-purdue-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <p className="text-sm text-[var(--color-text-secondary)] text-center max-w-xs">
                Generate a study guide from all uploaded PDF notes for this course.
                </p>
                <button
                onClick={handleGenerateStudyGuide}
                className="px-5 py-2.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
                >
                Generate Study Guide
                </button>
            </div>
            )}
            {/* Loading */}
            {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
                <p className="text-sm text-[var(--color-text-secondary)]">
                Analyzing notes and generating study guide...
                </p>
            </div>
            )}
            {/* Error */}
            {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
            </div>
            )}
            {/* Study Guide Result */}
            {studyGuide && (
            <div className="flex flex-col gap-4">
                <div
                className="p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)] max-h-[60vh] overflow-y-auto"
                style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', lineHeight: '1.6', color: 'var(--color-text-primary)' }}
                >
                <ReactMarkdown>{studyGuide}</ReactMarkdown>
                </div>
                <button
                onClick={handleGenerateStudyGuide}
                className="self-center px-4 py-2 text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors"
                >
                ↻ Regenerate
                </button>
            </div>
            )}
        </div>
        </div>
    );
}