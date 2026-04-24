import { useState, useEffect } from 'react';
import axios from 'axios';
import NoteUploadForm from './NoteUploadForm';
import NoteVoter from './NoteVoter';
import NoteCommentList from './NoteCommentList';
import StudyGuide from './StudyGuide';
import PracticeQuestions from './PracticeQuestions';
import CourseQA from './CourseQA';
import ExamDatesSection from './ExamDatesSection';

export default function CourseNotes({ courseId, courseName, onClose, userId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showStudyGuide, setShowStudyGuide] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [showPracticeQuestions, setShowPracticeQuestions] = useState(false);
  const [showCourseQA, setShowCourseQA] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    axios.get(`/api/courses/${courseId}/notes`)
      .then(res => {
        setNotes(res.data);
      })
      .catch(err => {
        console.error('Failed to fetch notes:', err);
        setError('Failed to load notes.');
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleUploadSuccess = (newNote) => {
    setNotes(prev => [newNote, ...prev]);
    setShowUploadForm(false);
  };

  const resolveDownloadUrl = (fileUrl) => {
    if (!fileUrl) return null;
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }

    return `${window.location.protocol}//${window.location.hostname}:5001${fileUrl}`;
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await axios.delete(`/api/notes/${noteId}`);
      setNotes(prev => prev.filter(n => n._id !== noteId));
    } catch (err) {
      console.error('Failed to delete note:', err);
      alert(err.response?.data?.error || 'Failed to delete note.');
    }
  };

  const toggleComments = (noteId) => {
    setExpandedComments((prev) => ({
      ...prev,
      [noteId]: !prev[noteId],
    }));
  };

  const handleDownload = async (note) => {
    try {
      const response = await axios.get(`/api/notes/${note._id}/download`, {
        maxRedirects: 0,
        validateStatus: (status) => status === 302,
      });
      const downloadUrl = resolveDownloadUrl(response.headers.location || note.fileUrl);
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      }
    } catch (err) {
      const downloadUrl = resolveDownloadUrl(note.fileUrl);
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      } else {
        console.error('Failed to download note:', err);
      }
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getFileIcon = (fileType) => {
    if (fileType === 'application/pdf') {
      return (
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  };

  return (
    <div className="background-blur">
      <div className="course-selector" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              Course Notes
            </h2>
            {courseName && (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {courseName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!showUploadForm && (
              <>
                <button
                  onClick={() => setShowPracticeQuestions(true)}
                  className="py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
                  style={{ paddingLeft: '10px', paddingRight: '10px', whiteSpace: 'nowrap' }}
                >
                  Practice Questions
                </button>
                <button
                  onClick={() => setShowCourseQA(true)}
                  className="py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
                  style={{ paddingLeft: '10px', paddingRight: '10px', whiteSpace: 'nowrap' }}
                >
                  Ask AI
                </button>
                <button
                  onClick={() => setShowStudyGuide(true)}
                  className="py-1.5 font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
                  style={{ 
                    position: 'relative',
                    overflow: 'visible',
                    background: 'linear-gradient(135deg, #6ee7b7, #818cf8, #c084fc, #f472b6)',
                    color: 'black',
                    paddingLeft: '10px',
                    paddingRight: '10px',
                    whiteSpace: 'nowrap' }}
                >
                  Generate Study Guide
                  <span style={{
                    color: 'white',
                    position: 'absolute',
                    top: '-6px',
                    right: '-2px',
                    fontSize: '12px',
                    animation: 'sparkle 1.5s ease-in-out infinite',
                  }}>✦</span>
                  <span style={{
                    color: 'white',
                    position: 'absolute',
                    bottom: '-6px',
                    left: '0px',
                    fontSize: '10px',
                    animation: 'sparkle 1.5s ease-in-out infinite 0.75s',
                  }}>✦</span>
                </button>
                <button
                  onClick={() => setShowUploadForm(true)}
                  className="py-1.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold text-xs rounded-lg hover:opacity-90 transition-opacity"
                  style={{ paddingLeft: '10px', paddingRight: '10px', whiteSpace: 'nowrap' }}
                >
                  + Upload
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Close course notes"
              className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Exam Dates */}
        <ExamDatesSection courseId={courseId} />

        {/* Upload Form */}
        {showUploadForm && (
          <div className="mb-6 p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)]">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Upload a Note</h3>
            <NoteUploadForm
              courseId={courseId}
              onUploadSuccess={handleUploadSuccess}
              onCancel={() => setShowUploadForm(false)}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading notes...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <svg className="w-10 h-10 text-[var(--color-text-secondary)]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-[var(--color-text-secondary)]">No notes uploaded yet.</p>
          </div>
        )}

        {/* Notes List */}
        {!loading && !error && notes.length > 0 && (
          <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            {notes.map(note => (
              <div
                key={note._id}
                className="flex items-start gap-3 p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)] hover:border-[var(--color-purdue-gold)]/30 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getFileIcon(note.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                    {note.title}
                  </h3>
                  {note.description && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                      {note.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      {note.uploadedBy?.profilePictureUrl ? (
                        <img src={note.uploadedBy.profilePictureUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center text-black font-bold" style={{ fontSize: '8px' }}>
                          {note.uploadedBy?.displayName?.[0] || '?'}
                        </span>
                      )}
                      {note.uploadedBy?.displayName || 'Unknown'}
                    </span>
                    <span>·</span>
                    <span>{formatTimestamp(note.createdAt)}</span>
                    <span>·</span>
                    <span>{formatFileSize(note.fileSize)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <NoteVoter
                    noteId={note._id}
                    initialVotes={note.voteCount || 0}
                    userVote={note.votes?.find(v => v.user === userId || v.user?._id === userId)?.vote || null}
                  />
                  <button
                    onClick={() => handleDownload(note)}
                    className="p-2 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                    title="Download"
                  >
                    <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => toggleComments(note._id)}
                    className="p-2 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                    title="Comments"
                  >
                    <svg className="w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-2 7a9 9 0 100-18 9 9 0 000 18z" />
                    </svg>
                  </button>
                  {userId && note.uploadedBy?._id === userId && (
                    <button
                      onClick={() => handleDelete(note._id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                {expandedComments[note._id] && (
                  <div className="mt-3 w-full">
                    <NoteCommentList noteId={note._id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {showStudyGuide && (
          <StudyGuide
            courseId={courseId}
            courseName={courseName}
            onClose={() => setShowStudyGuide(false)}
          />
        )}
        {showPracticeQuestions && (
          <PracticeQuestions
            courseId={courseId}
            courseName={courseName}
            onClose={() => setShowPracticeQuestions(false)}
          />
        )}
        {showCourseQA && (
          <CourseQA
            courseId={courseId}
            courseName={courseName}
            onClose={() => setShowCourseQA(false)}
          />
        )}
      </div>
    </div>
  );
}
