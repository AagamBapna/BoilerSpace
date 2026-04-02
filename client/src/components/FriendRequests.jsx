import { useState, useEffect } from 'react';
import axios from 'axios';

export default function FriendRequests({ onClose, onViewProfile }) {
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/friendships/pending');
      setIncoming(res.data.incoming);
      setOutgoing(res.data.outgoing);
    } catch {
      setError('Failed to load friend requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleAccept = async (id) => {
    try {
      await axios.put(`/api/friendships/${id}/accept`);
      fetchPending();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to accept request');
    }
  };

  const handleReject = async (id) => {
    try {
      await axios.put(`/api/friendships/${id}/reject`);
      fetchPending();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject request');
    }
  };

  const handleCancel = async (id) => {
    try {
      await axios.delete(`/api/friendships/${id}`);
      fetchPending();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel request');
    }
  };

  const renderUser = (user) => (
    <>
      {user.profilePictureUrl ? (
        <img src={user.profilePictureUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[var(--color-purdue-gold)]/20 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-[var(--color-purdue-gold)]">
          {user.displayName?.[0] || '?'}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{user.displayName}</p>
        <p className="text-xs text-[var(--color-text-secondary)] truncate">{user.major} · {user.year}</p>
      </div>
    </>
  );

  const list = tab === 'incoming' ? incoming : outgoing;

  return (
    <div className="background-blur" onClick={onClose}>
      <div className="course-selector" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Friend Requests</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('incoming')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === 'incoming'
                ? 'bg-[var(--color-purdue-gold)] text-black'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Incoming{incoming.length > 0 ? ` (${incoming.length})` : ''}
          </button>
          <button
            onClick={() => setTab('outgoing')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === 'outgoing'
                ? 'bg-[var(--color-purdue-gold)] text-black'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            Outgoing{outgoing.length > 0 ? ` (${outgoing.length})` : ''}
          </button>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
          </div>
        )}

        {error && <p className="text-sm text-red-400 text-center py-8">{error}</p>}

        {!loading && !error && list.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-12">
            No {tab} requests.
          </p>
        )}

        {!loading && !error && list.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto">
            {tab === 'incoming' && incoming.map(req => (
              <div
                key={req._id}
                onClick={() => onViewProfile(req.requester._id)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              >
                {renderUser(req.requester)}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAccept(req._id); }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--color-purdue-gold)] text-black hover:bg-[var(--color-purdue-gold-light)] transition-colors"
                  >
                    Accept
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReject(req._id); }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {tab === 'outgoing' && outgoing.map(req => (
              <div
                key={req._id}
                onClick={() => onViewProfile(req.recipient._id)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              >
                {renderUser(req.recipient)}
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancel(req._id); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors flex-shrink-0"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
