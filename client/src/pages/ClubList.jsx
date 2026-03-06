import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import SearchBar from '../components/SearchBar';

export default function ClubList() {
  const [clubs, setClubs] = useState([]);
  const [filteredClubs, setFilteredClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/clubs')
      .then(res => {
        setClubs(res.data);
        setFilteredClubs(res.data);
      })
      .catch(() => setError('Failed to load clubs.'))
      .finally(() => setLoading(false));
  }, []);

  // Called by SearchBar when query changes
  const handleSearchChange = useCallback((query) => {
    if (!query.trim()) {
      setFilteredClubs(clubs);
      return;
    }
    const q = query.toLowerCase();
    setFilteredClubs(
      clubs.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q))
      )
    );
  }, [clubs]);

  // SearchBar expects buildings with `name` and `abbreviation` fields.
  // We map clubs to that shape, using category as the abbreviation.
  const clubsForSearch = clubs.map(c => ({
    ...c,
    _id: c.id,
    abbreviation: c.category || '',
  }));

  const handleSelectClub = useCallback((club) => {
    navigate(`/clubs/${club.id}`);
  }, [navigate]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--color-surface)] text-[var(--color-text-primary)]">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/5 shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Clubs</h1>
          {!loading && !error && (
            <span className="text-sm text-[var(--color-text-secondary)]">
              {filteredClubs.length} club{filteredClubs.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/announcements')}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[var(--color-text-primary)] font-semibold text-sm rounded-lg transition-colors"
          >
            Announcements
          </button>
          <button
            onClick={() => navigate('/clubs/new')}
            className="px-4 py-2 bg-[var(--color-purdue-gold)] hover:bg-[var(--color-purdue-gold-light)] text-black font-semibold text-sm rounded-lg transition-colors"
          >
            + Create Club
          </button>
        </div>
      </div>

      {/* Search */}
      {!loading && !error && clubs.length > 0 && (
        <div className="px-8 py-4 border-b border-white/5 shrink-0">
          <SearchBar
            buildings={clubsForSearch}
            onSelectBuilding={handleSelectClub}
            onSearchChange={handleSearchChange}
          />
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading clubs...</p>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
          </div>
        )}

        {!loading && !error && filteredClubs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              {clubs.length === 0 ? 'No clubs yet.' : 'No clubs match your search.'}
            </p>
            {clubs.length === 0 && (
              <button
                onClick={() => navigate('/clubs/new')}
                className="text-xs text-[var(--color-purdue-gold)] hover:underline"
              >
                Create the first one →
              </button>
            )}
          </div>
        )}

        {!loading && !error && filteredClubs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredClubs.map(club => (
              <button
                key={club.id}
                onClick={() => navigate(`/clubs/${club.id}`)}
                className="group flex flex-col gap-2 p-6 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors text-left"
              >
                {club.category && (
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-purdue-gold)]">
                    {club.category}
                  </span>
                )}
                <h2 className="font-semibold text-base text-[var(--color-text-primary)] leading-snug">
                  {club.name}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed line-clamp-3 flex-1">
                  {club.description || 'No description available.'}
                </p>
                <span className="text-xs text-[var(--color-text-secondary)]/40 group-hover:text-[var(--color-purdue-gold)] transition-colors mt-1">
                  View details →
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}