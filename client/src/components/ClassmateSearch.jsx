import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ClassmateSearch({ onClose, onViewProfile }) {
  const [q, setQ] = useState('');
  const [studyStyle, setStudyStyle] = useState('');
  const [environment, setEnvironment] = useState('');
  const [interestsQuery, setInterestsQuery] = useState('');
  const [goalsQuery, setGoalsQuery] = useState('');

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (q.trim()) params.q = q.trim();
      if (studyStyle) params.studyStyle = studyStyle;
      if (environment) params.environment = environment;
      if (interestsQuery.trim()) params.interests = interestsQuery.trim();
      if (goalsQuery.trim()) params.studyGoals = goalsQuery.trim();

      const res = await axios.get('/api/users/discovery', { params });
      setResults(res.data);
      setHasSearched(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to perform search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Run automatically on first open to populate defaults based on matching preferences
  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div className="background-blur" onClick={onClose}>
      <div className="course-selector flex flex-col h-full max-h-[85vh]" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Find Classmates</h2>
            <p className="text-sm text-[var(--color-text-secondary)]">Search by goals, interests, and study styles</p>
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

        {/* ── Search Form ── */}
        <form onSubmit={handleSearch} className="flex flex-col gap-3 mb-4 flex-shrink-0 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] p-4 rounded-xl shadow-sm">
          <div>
             <input type="text" placeholder="Search by name..." value={q} onChange={(e) => setQ(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Study Style</label>
                <select value={studyStyle} onChange={(e) => setStudyStyle(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" >
                    <option value="">Any</option>
                    <option value="solo">Solo</option>
                    <option value="group">Group</option>
                    <option value="mixed">Mixed</option>
                </select>
             </div>
             <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Environment</label>
                <select value={environment} onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" >
                    <option value="">Any</option>
                    <option value="quiet">Quiet</option>
                    <option value="moderate">Moderate</option>
                    <option value="collaborative">Collaborative</option>
                </select>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Interests</label>
                <input type="text" placeholder="e.g. math, hiking" value={interestsQuery} onChange={(e) => setInterestsQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
             </div>
             <div>
                <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">Study Goals</label>
                <input type="text" placeholder="e.g. pass exams" value={goalsQuery} onChange={(e) => setGoalsQuery(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
             </div>
          </div>

          <button type="submit" disabled={loading} className="w-full mt-1 bg-[var(--color-purdue-gold)] text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-[var(--color-purdue-gold-light)] transition-colors disabled:opacity-50">
             {loading ? 'Searching...' : 'Search Classmates'}
          </button>
        </form>

        {/* ── Results Container ── */}
        <div className="flex-1 overflow-y-auto px-1 min-h-0">
          {error && <p className="text-sm text-red-400 text-center py-4">{error}</p>}

          {!loading && !error && hasSearched && results.length === 0 && (
             <div className="flex flex-col items-center justify-center py-12 gap-2 text-[var(--color-text-secondary)]">
                <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" /></svg>
                <p className="text-sm">No results found.</p>
                <p className="text-xs opacity-80">Try softening your search criteria.</p>
             </div>
          )}

          {!loading && !error && results.length > 0 && (
            <div className="flex flex-col gap-4">
              {results.map(user => (
                <div key={user._id} onClick={() => onViewProfile(user._id)} className="flex gap-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-purdue-gold)] hover:shadow-[0_0_15px_rgba(206,184,136,0.1)] transition-all cursor-pointer">
                  {user.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center flex-shrink-0 text-black font-bold">
                       {user.displayName?.[0] || '?'}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                     <div className="flex items-start justify-between">
                        <div>
                           <h3 className="font-bold text-[var(--color-text-primary)] text-base leading-tight truncate">{user.displayName}</h3>
                           <p className="text-[11px] text-[var(--color-text-secondary)] truncate uppercase tracking-widest">{user.major} · {user.year}</p>
                        </div>
                        <div className="bg-[var(--color-surface-elevated)] px-2 py-1 rounded-md border border-[var(--color-border)] flex items-center gap-1">
                           <svg className="w-3 h-3 text-[var(--color-purdue-gold)]" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                           <span className="text-xs font-bold text-[var(--color-purdue-gold)]">{user.matchScore}</span>
                        </div>
                     </div>

                     {user.matchHighlights && user.matchHighlights.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                           {user.matchHighlights.map((hl, i) => (
                              <span key={i} className="px-2 py-0.5 bg-[var(--color-purdue-gold)]/10 border border-[var(--color-purdue-gold)]/20 text-[var(--color-purdue-gold)] rounded text-[10px] whitespace-nowrap">
                                 {hl}
                              </span>
                           ))}
                        </div>
                     )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
