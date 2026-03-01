import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ClubProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`/api/clubs/${id}`)
      .then(res => setClub(res.data))
      .catch(err => {
        if (err.response?.status === 404) setError('Club not found.');
        else setError('Failed to load club.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--color-surface)] text-[var(--color-text-primary)]">

      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-white/5 shrink-0">
        <button
          onClick={() => navigate('/clubs')}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          ← Back to Clubs
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading club...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
            <button
              onClick={() => navigate('/clubs')}
              className="text-xs text-[var(--color-purdue-gold)] hover:underline"
            >
              Back to clubs
            </button>
          </div>
        )}

        {!loading && !error && club && (
          <div className="max-w-2xl mx-auto px-8 py-10 flex flex-col gap-6">

            {/* Category + Name */}
            <div>
              {club.category && (
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-purdue-gold)] mb-2">
                  {club.category}
                </p>
              )}
              <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">
                {club.name}
              </h1>
            </div>

            <div className="h-px bg-white/5" />

            {/* Description */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/20 mb-2">About</p>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {club.description || 'No description available.'}
              </p>
            </div>

            <div className="h-px bg-white/5" />

            {/* Meta */}
            <div className="flex flex-col gap-4">
              {club.contactInfo && (
                <div className="flex gap-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/20 w-20 shrink-0 pt-px">Contact</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{club.contactInfo}</span>
                </div>
              )}
              {club.createdAt && (
                <div className="flex gap-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/20 w-20 shrink-0 pt-px">Added</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {new Date(club.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}