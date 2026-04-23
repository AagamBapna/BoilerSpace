import { useState, useEffect } from 'react';
import axios from 'axios';
import { formatRelative } from '../utils/formatRelative';

export default function RoomReviews({ roomId, user }) {
    const [reviewsData, setReviewsData] = useState({ reviews: [], averageRating: 0, totalReviews: 0 });
    const [loading, setLoading] = useState(true);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const fetchReviews = async () => {
        try {
            const res = await axios.get(`/api/reviews/${roomId}`);
            setReviewsData(res.data);
        } catch (err) {
            console.error('Failed to load reviews:', err);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchReviews();
    }, [roomId]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            setError('Please select a star rating.');
            return;
        }
        if (!comment.trim()) {
            setError('Please enter a comment.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            await axios.post('/api/reviews', {
                roomId,
                rating,
                comment,
            });
            setRating(0);
            setHoverRating(0);
            setComment('');
            await fetchReviews();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to submit review');
        } finally {
            setSubmitting(false);
        }
    };
    if (loading) {
        return <div className="text-[11px] text-[var(--color-text-secondary)] italic p-2">Loading reviews...</div>;
    }
    return (
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-col gap-4">
            {/* Summary Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h5 className="text-sm font-bold text-white mb-0.5">Reviews</h5>
                    {reviewsData.totalReviews > 0 ? (
                        <p className="text-xs text-[var(--color-purdue-gold)] font-medium flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {reviewsData.averageRating} / 5 <span className="text-[var(--color-text-secondary)]">({reviewsData.totalReviews})</span>
                        </p>
                    ) : (
                        <p className="text-xs text-[var(--color-text-secondary)]">No reviews yet</p>
                    )}
                </div>
            </div>
            {/* Submission Form */}
            {user ? (
                <form onSubmit={handleSubmit} className="bg-[#1a1a1a] p-3 rounded-lg border border-white/10 flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Leave a Review</span>
                        <div className="flex items-center cursor-pointer">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => setRating(star)}
                                    className={`w-5 h-5 transition-colors ${(hoverRating || rating) >= star ? 'text-[var(--color-purdue-gold)]' : 'text-white/20'
                                        }`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            ))}
                        </div>
                    </div>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="What's this spot like for studying?"
                        className="w-full bg-[#111111] text-xs text-white p-2.5 rounded border border-white/5 focus:border-[var(--color-purdue-gold)] focus:outline-none resize-none transition-colors"
                        rows={2}
                    />
                    {error && <p className="text-[#ef4444] text-xs font-semibold">{error}</p>}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-[var(--color-purdue-gold)] text-black text-xs font-bold px-4 py-1.5 rounded disabled:opacity-50 transition-opacity hover:bg-opacity-90"
                        >
                            {submitting ? 'Posting...' : 'Post Review'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="text-center p-3 border border-white/5 rounded-lg bg-[var(--color-surface-hover)]">
                    <p className="text-xs text-[var(--color-text-secondary)]">Sign in to leave a review</p>
                </div>
            )}
            {/* List of Reviews */}
            <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-1 stylish-scrollbar">
                {reviewsData.reviews.map((review) => (
                    <div key={review._id} className="bg-[var(--color-surface-hover)] p-3 rounded-lg flex flex-col gap-2 relative">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{review.userId?.displayName || 'Anonymous'}</span>
                            <span className="text-[10px] text-[var(--color-text-secondary)]">{formatRelative(review.createdAt)}</span>
                        </div>
                        <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <svg
                                    key={star}
                                    className={`w-3 h-3 ${review.rating >= star ? 'text-[var(--color-purdue-gold)]' : 'text-white/10'}`}
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            ))}
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-0.5 whitespace-pre-wrap word-break">
                            {review.comment}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}