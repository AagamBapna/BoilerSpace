import { useState, useEffect } from 'react';
import axios from 'axios';

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NoteCommentList({ noteId, userId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`/api/notes/${noteId}/comments`);
      setComments(res.data.comments);
    } catch {
      setError('Failed to load comments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (noteId) fetchComments();
  }, [noteId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    try {
      setSubmitting(true);
      const res = await axios.post(`/api/notes/${noteId}/comments`, { content: newComment.trim() });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await axios.delete(`/api/notes/${noteId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c._id !== commentId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete comment.');
    }
  };

  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
      <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Comments ({comments.length})
      </h4>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-3">
          <div className="w-4 h-4 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
          <span className="text-xs text-[var(--color-text-secondary)]">Loading comments...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 py-2">{error}</p>
      )}

      {/* Comments */}
      {!loading && !error && (
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-xs text-[var(--color-text-secondary)] py-2">No comments yet. Be the first to comment!</p>
          )}
          {comments.map(comment => (
            <div key={comment._id} className="flex items-start gap-2 group">
              {/* Avatar */}
              {comment.userId?.profilePictureUrl ? (
                <img
                  src={comment.userId.profilePictureUrl}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5"
                />
              ) : (
                <span
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center text-black font-bold flex-shrink-0 mt-0.5"
                  style={{ fontSize: '10px' }}
                >
                  {comment.userId?.displayName?.[0] || '?'}
                </span>
              )}
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {comment.userId?.displayName || 'Unknown'}
                  </span>
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {timeAgo(comment.createdAt)}
                  </span>
                  {userId && comment.userId?._id === userId && (
                    <button
                      onClick={() => handleDelete(comment._id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                      title="Delete comment"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-primary)] break-words whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          maxLength={2000}
          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]/50"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || submitting}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? '...' : 'Post'}
        </button>
      </form>
    </div>
  );
}
