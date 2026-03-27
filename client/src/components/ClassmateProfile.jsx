import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ClassmateProfile({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [friendship, setFriendship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, classmatesRes] = await Promise.all([
        axios.get(`/api/users/${userId}`),
        axios.get('/api/friendships/classmates'),
      ]);
      setProfile(profileRes.data);

      // Find friendship status from classmates data
      for (const group of classmatesRes.data) {
        const match = group.classmates.find(c => c._id === userId);
        if (match?.friendship) {
          setFriendship(match.friendship);
          break;
        }
      }

      // Also check pending/friends if not found in classmates
      if (!friendship) {
        const [pendingRes, friendsRes] = await Promise.all([
          axios.get('/api/friendships/pending'),
          axios.get('/api/friendships/friends'),
        ]);
        const incomingMatch = pendingRes.data.incoming.find(r => r.requester._id === userId);
        if (incomingMatch) {
          setFriendship({ id: incomingMatch._id, status: 'pending', direction: 'incoming' });
          return;
        }
        const outgoingMatch = pendingRes.data.outgoing.find(r => r.recipient._id === userId);
        if (outgoingMatch) {
          setFriendship({ id: outgoingMatch._id, status: 'pending', direction: 'outgoing' });
          return;
        }
        const friendMatch = friendsRes.data.find(f => f._id === userId);
        if (friendMatch) {
          setFriendship({ id: friendMatch.friendshipId, status: 'accepted', direction: null });
        }
      }
    } catch {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const handleAddFriend = async () => {
    try {
      await axios.post('/api/friendships/request', { recipientId: userId });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send friend request');
    }
  };

  const handleAccept = async () => {
    try {
      await axios.put(`/api/friendships/${friendship.id}/accept`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept request');
    }
  };

  const handleUnfriend = async () => {
    try {
      await axios.delete(`/api/friendships/${friendship.id}`);
      setFriendship(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unfriend');
    }
  };

  const isPrivate = profile?.profileVisibility === 'private' && !profile?.courses;

  const renderActionButton = () => {
    if (!friendship) {
      if (isPrivate) return null;
      return (
        <button
          onClick={handleAddFriend}
          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors"
        >
          Add Friend
        </button>
      );
    }
    if (friendship.status === 'accepted') {
      return (
        <button
          onClick={handleUnfriend}
          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Unfriend
        </button>
      );
    }
    if (friendship.status === 'pending' && friendship.direction === 'outgoing') {
      return (
        <div className="w-full py-2.5 text-sm font-semibold rounded-lg bg-yellow-500/20 text-yellow-400 text-center">
          Request Pending
        </div>
      );
    }
    if (friendship.status === 'pending' && friendship.direction === 'incoming') {
      return (
        <button
          onClick={handleAccept}
          className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors"
        >
          Accept Friend Request
        </button>
      );
    }
    return null;
  };

  return (
    <div className="background-blur" onClick={onClose}>
      <div className="course-selector" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-end mb-2">
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

        {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}

        {!loading && !error && profile && (
          <div className="flex flex-col items-center gap-4">
            {/* Avatar */}
            {profile.profilePictureUrl ? (
              <img src={profile.profilePictureUrl} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[var(--color-purdue-gold)]/20 flex items-center justify-center text-2xl font-bold text-[var(--color-purdue-gold)]">
                {profile.displayName?.[0] || '?'}
              </div>
            )}

            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{profile.displayName}</h2>

            {isPrivate ? (
              <p className="text-sm text-[var(--color-text-secondary)]">This profile is private.</p>
            ) : (
              <>
                {/* Info */}
                <div className="flex gap-4 text-sm text-[var(--color-text-secondary)]">
                  {profile.major && <span>{profile.major}</span>}
                  {profile.year && <span>{profile.year}</span>}
                </div>

                {/* Courses */}
                {profile.courses && profile.courses.length > 0 && (
                  <div className="w-full mt-2">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Courses</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.courses.map(course => (
                        <span
                          key={course._id}
                          className="px-2.5 py-1 text-xs rounded-md bg-[var(--color-purdue-gold)]/10 text-[var(--color-purdue-gold)] font-medium"
                        >
                          {course.courseCode || course}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Availability */}
                {profile.availability && profile.availability.length > 0 && (
                  <div className="w-full mt-2">
                    <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Availability</h3>
                    <div className="flex flex-col gap-1">
                      {profile.availability.map((slot, i) => (
                        <div key={i} className="flex justify-between text-xs text-[var(--color-text-secondary)] px-1">
                          <span className="font-medium text-[var(--color-text-primary)]">{slot.day}</span>
                          <span>{slot.startTime} – {slot.endTime}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Action button */}
            <div className="w-full mt-4">
              {renderActionButton()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
