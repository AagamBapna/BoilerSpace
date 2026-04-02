import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ClassmateDiscovery({ onClose, onViewProfile }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchClassmates = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/friendships/classmates');
      setGroups(res.data);
    } catch {
      setError('Failed to load classmates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClassmates(); }, []);

  const handleAddFriend = async (recipientId) => {
    try {
      await axios.post('/api/friendships/request', { recipientId });
      fetchClassmates();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send friend request');
    }
  };

  const handleAccept = async (friendshipId) => {
    try {
      await axios.put(`/api/friendships/${friendshipId}/accept`);
      fetchClassmates();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept request');
    }
  };

  const renderActionButton = (classmate) => {
    const f = classmate.friendship;
    if (!f) {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); handleAddFriend(classmate._id); }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors"
        >
          Add Friend
        </button>
      );
    }
    if (f.status === 'accepted') {
      return (
        <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-500/20 text-green-400">
          Friends
        </span>
      );
    }
    if (f.status === 'pending' && f.direction === 'outgoing') {
      return (
        <span className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-yellow-500/20 text-yellow-400">
          Pending
        </span>
      );
    }
    if (f.status === 'pending' && f.direction === 'incoming') {
      return (
        <button
          onClick={(e) => { e.stopPropagation(); handleAccept(f.id); }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors"
        >
          Accept
        </button>
      );
    }
    return null;
  };

  return (
    <div className="background-blur" onClick={onClose}>
      <div className="course-selector" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Classmates</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Students in your courses</p>
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

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 text-center py-8">{error}</p>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-sm text-[var(--color-text-secondary)]">No classmates found.</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Enroll in courses to discover classmates.</p>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto">
            {groups.map(group => (
              <div key={group.courseId}>
                <h3 className="text-sm font-semibold text-[var(--color-purdue-gold)] mb-2">
                  {group.courseCode} — {group.courseTitle}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {group.classmates.map(classmate => (
                    <div
                      key={classmate._id}
                      onClick={() => onViewProfile(classmate._id)}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                    >
                      {classmate.profilePictureUrl ? (
                        <img
                          src={classmate.profilePictureUrl}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[var(--color-purdue-gold)]/20 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-[var(--color-purdue-gold)]">
                          {classmate.displayName?.[0] || '?'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{classmate.displayName}</p>
                        <p className="text-xs text-[var(--color-text-secondary)] truncate">{classmate.major} · {classmate.year}</p>
                      </div>
                      {renderActionButton(classmate)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
