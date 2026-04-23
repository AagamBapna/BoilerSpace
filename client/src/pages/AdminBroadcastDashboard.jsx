import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getToken } from '../lib/auth';

export default function AdminBroadcastDashboard({ user }) {
  const navigate = useNavigate();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('info');
  const [expirationDate, setExpirationDate] = useState('');

  useEffect(() => {
    if (!user || (!user.isAdmin)) {
      navigate('/');
      return;
    }
    
    fetchBroadcasts();
  }, [user, navigate]);

  const fetchBroadcasts = async () => {
    try {
      const res = await axios.get('/api/announcements/broadcasts', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setBroadcasts(res.data);
    } catch (err) {
      setError('Failed to fetch broadcasts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !body) return;
    try {
      await axios.post('/api/announcements/broadcast', {
        title, body, priorityLevel, expirationDate
      }, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      setTitle('');
      setBody('');
      setPriorityLevel('info');
      setExpirationDate('');
      fetchBroadcasts();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to post broadcast');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this broadcast?')) return;
    try {
      await axios.delete(`/api/announcements/broadcasts/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      fetchBroadcasts();
    } catch (err) {
      alert('Failed to delete broadcast');
    }
  };

  if (!user || (!user.isAdmin)) return null;

  // calculate live preview preview
  let bgColorClass, textColorClass, iconPath;

  switch(priorityLevel) {
    case 'alert':
      bgColorClass = 'bg-red-500/10 border-red-500/30';
      textColorClass = 'text-red-400';
      iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
      break;
    case 'warning':
      bgColorClass = 'bg-yellow-500/10 border-yellow-500/30';
      textColorClass = 'text-yellow-400';
      iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
      break;
    case 'info':
    default:
      bgColorClass = 'bg-blue-500/10 border-blue-500/30';
      textColorClass = 'text-blue-400';
      iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
      break;
  }

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface)] text-[var(--color-text-primary)] p-8">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Broadcast Dashboard</h1>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-[var(--color-surface-hover)] rounded-lg">Back to App</button>
        </div>

        <div className="bg-[var(--color-surface-light)] rounded-xl p-6 shadow-md">
          <h2 className="text-xl font-bold mb-4">Draft New Broadcast</h2>
          
          <div className="mb-6">
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">Live Preview</p>
            <div className={`w-full py-3 px-4 sm:px-6 relative flex items-center justify-between border ${bgColorClass} rounded-lg`}>
              <div className="flex items-start sm:items-center gap-3">
                <div className={`shrink-0 ${textColorClass} mt-0.5 sm:mt-0`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {iconPath}
                  </svg>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className={`font-bold text-sm ${textColorClass}`}>{title || 'Banner Title'}</span>
                  <span className="hidden sm:inline-block text-[var(--color-text-secondary)] mx-1">&middot;</span>
                  <span className="text-sm text-[var(--color-text-primary)]">{body || 'Banner body text will appear here'}</span>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Title *</label>
                <input 
                  type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  className="bg-[var(--color-surface)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-purdue-gold)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Priority Level *</label>
                <select 
                  value={priorityLevel} onChange={(e) => setPriorityLevel(e.target.value)}
                  className="bg-[var(--color-surface)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-purdue-gold)]"
                >
                  <option value="info">Info (Blue)</option>
                  <option value="warning">Warning (Yellow)</option>
                  <option value="alert">Alert (Red)</option>
                </select>
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Message Body *</label>
              <textarea 
                required value={body} onChange={(e) => setBody(e.target.value)} rows={3}
                className="bg-[var(--color-surface)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-purdue-gold)] resize-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Expiration Date (Optional)</label>
              <input 
                type="datetime-local" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
                className="bg-[var(--color-surface)] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-purdue-gold)]"
              />
              <p className="text-xs text-[var(--color-text-secondary)]">Defaults to 7 days if left blank.</p>
            </div>

            <button type="submit" className="mt-2 bg-[var(--color-purdue-gold)] text-black font-semibold py-2 px-4 rounded-lg hover:bg-yellow-500 transition-colors">
              Publish Broadcast
            </button>
          </form>
        </div>

        <div className="bg-[var(--color-surface-light)] rounded-xl p-6 shadow-md">
          <h2 className="text-xl font-bold mb-4">Past & Active Broadcasts</h2>
          {loading && <p className="text-sm">Loading...</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex flex-col gap-3">
            {broadcasts.length === 0 && !loading && <p className="text-sm text-[var(--color-text-secondary)]">No broadcasts found.</p>}
            {broadcasts.map(b => (
              <div key={b.id} className="flex items-start justify-between bg-[var(--color-surface)] p-4 rounded-lg border border-white/5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[var(--color-text-primary)]">{b.title}</span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${
                      b.priorityLevel === 'alert' ? 'bg-red-500/20 text-red-500' :
                      b.priorityLevel === 'warning' ? 'bg-yellow-500/20 text-yellow-500' :
                      'bg-blue-500/20 text-blue-500'
                    }`}>
                      {b.priorityLevel}
                    </span>
                    {new Date(b.expirationDate) > new Date() ? (
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-bold bg-green-500/20 text-green-500">Active</span>
                    ) : (
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-bold bg-gray-500/20 text-gray-400">Expired</span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)]">{b.body}</p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-2">Expires: {new Date(b.expirationDate).toLocaleString()}</p>
                </div>
                <button onClick={() => handleDelete(b.id)} className="text-red-400 hover:text-red-300 text-sm font-semibold">
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
