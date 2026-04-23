import { useState, useEffect } from 'react';
import axios from 'axios';

export default function GlobalEventBanner() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState(() => JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]'));

  useEffect(() => {
    const fetchBroadcasts = async () => {
      try {
        const res = await axios.get('/api/announcements/active');
        if (res.data && Array.isArray(res.data)) {
          setBroadcasts(res.data);
        } else if (res.data) {
          setBroadcasts([res.data]);
        } else {
          setBroadcasts([]);
        }
      } catch (err) {
        console.error('Failed to fetch global broadcasts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBroadcasts();
    const interval = setInterval(fetchBroadcasts, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = (id) => {
    const newDismissed = [...dismissedIds, id];
    localStorage.setItem('dismissed_broadcasts', JSON.stringify(newDismissed));
    setDismissedIds(newDismissed);
  };

  if (loading || !broadcasts.length) return null;

  const activeBroadcasts = broadcasts.filter(b => !dismissedIds.includes(b.id || b._id));
  if (activeBroadcasts.length === 0) return null;

  return (
    <div className="flex flex-col w-full z-50">
      {activeBroadcasts.map(broadcast => {
        let bgColorClass, textColorClass, iconPath;

        switch(broadcast.priorityLevel) {
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
          <div key={broadcast.id || broadcast._id} className={`w-full py-3 px-4 sm:px-6 relative flex items-center justify-between border-b ${bgColorClass}`}>
            <div className="flex items-start sm:items-center gap-3">
              <div className={`shrink-0 ${textColorClass} mt-0.5 sm:mt-0`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {iconPath}
                </svg>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className={`font-bold text-sm ${textColorClass}`}>{broadcast.title}</span>
                <span className="hidden sm:inline-block text-[var(--color-text-secondary)] mx-1">&middot;</span>
                <span className="text-sm text-[var(--color-text-primary)]">{broadcast.body}</span>
              </div>
            </div>
            <button 
              onClick={() => handleDismiss(broadcast.id || broadcast._id)} 
              className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors ml-4"
              aria-label="Dismiss banner"
            >
              <svg className="w-5 h-5 text-[var(--color-text-secondary)] hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
