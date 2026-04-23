import { useState, useEffect } from 'react';
import axios from 'axios';
import { getToken } from '../lib/auth';

export default function AdminBroadcastDashboard({ user, onClose }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('info');
  const [expirationDate, setExpirationDate] = useState('');

  useEffect(() => {
    if (!user || (!user.isAdmin)) {
      if (onClose) onClose();
      return;
    }
    
    fetchBroadcasts();
  }, [user, onClose]);

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
    <div className="background-blur flex items-center justify-center p-6 sm:p-10 z-[60]">
      <div className="bg-[var(--color-surface)] rounded-3xl border border-[var(--color-purdue-gold)]/20 shadow-2xl w-full max-w-5xl max-h-[96vh] flex flex-col relative animate-dropdownIn overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-8 sm:px-10 border-b border-white/5 shrink-0 bg-[var(--color-surface-light)]">
           <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] bg-clip-text text-transparent tracking-tight">
             Admin Dashboard
           </h1>
           <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-colors">
             <svg className="w-6 h-6 text-white/50 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 sm:p-10 text-[var(--color-text-primary)]">
          <div className="flex flex-col gap-10">
            <div className="bg-black/30 rounded-3xl p-8 sm:p-10 border border-white/5">
              <h2 className="text-2xl font-bold mb-8 tracking-tight">Draft New Broadcast</h2>
              
              <div className="mb-8">
                <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">Live Preview</p>
                <div className={`w-full py-5 px-6 sm:px-8 relative flex items-center justify-between border ${bgColorClass} rounded-2xl shadow-sm`}>
                  <div className="flex items-start sm:items-center gap-4">
                    <div className={`shrink-0 ${textColorClass} mt-0.5 sm:mt-0`}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {iconPath}
                      </svg>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className={`font-bold text-base ${textColorClass}`}>{title || 'Banner Title'}</span>
                      <span className="hidden sm:inline-block text-[var(--color-text-secondary)] mx-1 text-lg">&middot;</span>
                      <span className="text-base text-[var(--color-text-primary)]">{body || 'Banner body text will appear here'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Title *</label>
                    <input 
                      type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                      className="bg-[var(--color-surface-light)] border border-white/10 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[var(--color-purdue-gold)] transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Priority Level *</label>
                    <select 
                      value={priorityLevel} onChange={(e) => setPriorityLevel(e.target.value)}
                      className="bg-[var(--color-surface-light)] border border-white/10 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[var(--color-purdue-gold)] transition-colors"
                    >
                      <option value="info">Info (Blue)</option>
                      <option value="warning">Warning (Yellow)</option>
                      <option value="alert">Alert (Red)</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Message Body *</label>
                  <textarea 
                    required value={body} onChange={(e) => setBody(e.target.value)} rows={4}
                    className="bg-[var(--color-surface-light)] border border-white/10 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[var(--color-purdue-gold)] resize-none transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Expiration Date (Optional)</label>
                  <input 
                    type="datetime-local" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
                    className="bg-[var(--color-surface-light)] border border-white/10 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:border-[var(--color-purdue-gold)] transition-colors"
                  />
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">Defaults to 7 days if left blank.</p>
                </div>

                <button type="submit" className="mt-4 bg-[var(--color-purdue-gold)] text-black font-extrabold py-3.5 px-6 rounded-2xl hover:bg-yellow-500 transition-colors cursor-pointer w-full sm:w-auto self-start text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 duration-200">
                  Publish Broadcast
                </button>
              </form>
            </div>

            <div className="bg-black/30 rounded-3xl p-8 sm:p-10 border border-white/5">
              <h2 className="text-2xl font-bold mb-8 tracking-tight">Past & Active Broadcasts</h2>
              {loading && <p className="text-base text-[var(--color-text-secondary)]">Loading...</p>}
              {error && <p className="text-base text-red-400">{error}</p>}
              <div className="flex flex-col gap-4">
                {broadcasts.length === 0 && !loading && <p className="text-base text-[var(--color-text-secondary)]">No broadcasts found.</p>}
                {broadcasts.map(b => (
                  <div key={b.id} className="flex flex-col sm:flex-row sm:items-start justify-between bg-[var(--color-surface)] p-6 rounded-2xl border border-white/5 gap-6 hover:bg-[var(--color-surface-hover)] transition-colors">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="font-bold text-lg text-[var(--color-text-primary)]">{b.title}</span>
                        <span className={`text-[11px] uppercase tracking-wider px-3.5 py-1.5 rounded-full font-bold ${
                          b.priorityLevel === 'alert' ? 'bg-red-500/20 text-red-500' :
                          b.priorityLevel === 'warning' ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-blue-500/20 text-blue-500'
                        }`}>
                          {b.priorityLevel}
                        </span>
                        {new Date(b.expirationDate) > new Date() ? (
                          <span className="text-[11px] uppercase tracking-wider px-3.5 py-1.5 rounded-full font-bold bg-green-500/20 text-green-500">Live</span>
                        ) : (
                          <span className="text-[11px] uppercase tracking-wider px-3.5 py-1.5 rounded-full font-bold bg-gray-500/20 text-gray-400">Expired</span>
                        )}
                      </div>
                      <p className="text-base text-[var(--color-text-secondary)] leading-relaxed">{b.body}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]/50 mt-4 font-mono">Expires: {new Date(b.expirationDate).toLocaleString()}</p>
                    </div>
                    <button onClick={() => handleDelete(b.id)} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-sm font-bold rounded-xl transition-colors shrink-0 outline-none focus:ring-2 focus:ring-red-500/40">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
