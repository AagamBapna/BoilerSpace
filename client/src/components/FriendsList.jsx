import { useState, useEffect } from 'react';
import axios from 'axios';

export default function FriendsList({ onClose, onViewProfile }) {
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/friendships/friends');
      setFriends(res.data);
    } catch {
      setError('Failed to load friends.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFriends(); }, []);

  const handleUnfriend = async (friendshipId) => {
    try {
      await axios.delete(`/api/friendships/${friendshipId}`);
      fetchFriends();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unfriend');
    }
  };

  const filtered = friends.filter(f =>
    f.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="background-blur" onClick={onClose}>
      <div className="course-selector" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Friends</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">{friends.length} friend{friends.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {friends.length > 3 && (
          <input
            type="text"
            placeholder="Search friends..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 mb-4 text-sm rounded-lg bg-[var(--color-surface)] border border-[rgba(206,184,136,0.15)] text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
          />
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}

        {!loading && !error && friends.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">No friends yet.</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Discover classmates to start connecting.</p>
          </div>
        )}

        {!loading && !error && friends.length > 0 && filtered.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-12">No matches found.</p>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-[55vh] overflow-y-auto">
            {filtered.map(friend => (
              <div
                key={friend.friendshipId}
                onClick={() => onViewProfile(friend._id)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              >
                {friend.profilePictureUrl ? (
                  <img src={friend.profilePictureUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[var(--color-purdue-gold)]/20 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-[var(--color-purdue-gold)]">
                    {friend.displayName?.[0] || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{friend.displayName}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] truncate">{friend.major} · {friend.year}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleUnfriend(friend.friendshipId); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex-shrink-0"
                >
                  Unfriend
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
