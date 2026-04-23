import { useState, useEffect } from 'react';
import axios from 'axios';

export default function GlobalEventBanner({ isMapPage }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState(() => JSON.parse(localStorage.getItem('dismissed_broadcasts') || '[]'));
  const [expandedIds, setExpandedIds] = useState(new Set());

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

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading || !broadcasts.length) return null;

  const activeBroadcasts = broadcasts.filter(b => !dismissedIds.includes(b.id || b._id));
  if (activeBroadcasts.length === 0) return null;

  return (
    <div className={`fixed top-4 z-[35] flex flex-col gap-3 w-full max-w-[320px] sm:max-w-sm pointer-events-none transition-all duration-300 ${
      isMapPage ? 'left-4 md:left-[384px]' : 'left-4 sm:left-6'
    }`}>
      {activeBroadcasts.map(broadcast => {
        const id = broadcast.id || broadcast._id;
        const isExpanded = expandedIds.has(id);
        let bgColorClass, textColorClass, iconPath;

        switch (broadcast.priorityLevel) {
          case 'alert':
            bgColorClass = 'bg-red-500/20 border-red-500/40 text-red-50 hover:bg-red-500/30';
            textColorClass = 'text-red-400';
            iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
            break;
          case 'warning':
            bgColorClass = 'bg-yellow-500/20 border-yellow-500/40 text-yellow-50 hover:bg-yellow-500/30';
            textColorClass = 'text-yellow-400';
            iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />;
            break;
          case 'info':
          default:
            bgColorClass = 'bg-blue-500/20 border-blue-500/40 text-blue-50 hover:bg-blue-500/30';
            textColorClass = 'text-blue-400';
            iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />;
            break;
        }
        const bannerBgClass = bgColorClass.split(' ').filter(c => !c.startsWith('hover:')).join(' ');
        const hoverBgClass = bgColorClass.split(' ').find(c => c.startsWith('hover:')) || '';

        return (
          <div key={id} className={`w-full relative flex flex-col border ${bannerBgClass} transition-all duration-200 shadow-xl backdrop-blur-md rounded-2xl pointer-events-auto overflow-hidden`}>
            <div
              className={`flex items-start justify-between py-3 px-4 cursor-pointer ${hoverBgClass} transition-colors`}
              onClick={() => toggleExpand(id)}
            >
              <div className="flex items-start gap-3 overflow-hidden flex-1">
                <div className={`shrink-0 ${textColorClass} mt-0.5`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {iconPath}
                  </svg>
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                  <span className={`font-bold text-sm ${textColorClass} whitespace-nowrap overflow-hidden text-ellipsis`}>{broadcast.title}</span>
                  {!isExpanded && (
                    <span className="text-xs text-[var(--color-text-primary)] truncate opacity-90">{broadcast.body}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-0.5 shrink-0 ml-3">
                <div className={`p-1.5 rounded-lg transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  <svg className={`w-4 h-4 ${textColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDismiss(id); }}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-black/20 transition-colors"
                  aria-label="Dismiss banner"
                >
                  <svg className="w-4 h-4 text-[var(--color-text-secondary)] hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 pt-1 text-sm text-[var(--color-text-primary)] leading-relaxed bg-black/10 border-t border-white/5">
                {broadcast.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
