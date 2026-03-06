import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function ClubProfile({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice || null);

  useEffect(() => {
    axios.get(`/api/clubs/${id}`)
      .then(res => setClub(res.data))
      .catch(err => {
        if (err.response?.status === 404) setError('Club not found.');
        else setError('Failed to load club.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const isOrganizer = Boolean(
    user?.id && Array.isArray(club?.organizerIds) && club.organizerIds.map(String).includes(String(user.id))
  );

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 pr-4 pl-8 sm:pr-6 sm:pl-12 md:pr-8 md:pl-16 lg:pr-10 lg:pl-20 xl:pr-12 xl:pl-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/clubs')} className="profile-button-like">Clubs</button>
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/announcements')} className="profile-button-like">Announcements</button>
      </div>

      <div className="w-full max-w-[1500px] mx-auto flex flex-col gap-7 pt-14 sm:pt-16">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl bg-[var(--color-surface-light)] ml-8 sm:ml-12 md:ml-16 lg:ml-20">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
            <p className="text-sm text-[var(--color-text-secondary)]">Loading club...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 rounded-2xl bg-[var(--color-surface-light)] ml-8 sm:ml-12 md:ml-16 lg:ml-20">
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
          <div className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7 ml-8 sm:ml-12 md:ml-16 lg:ml-20">
          <div className="max-w-3xl mx-auto flex flex-col gap-6">

            {notice && (
              <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
                {notice}
              </div>
            )}

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

            <div className="flex gap-3 pt-2">
              {isOrganizer && (
                <button
                  onClick={() => navigate(`/clubs/${id}/dashboard`)}
                  className="px-5 py-2.5 bg-[var(--color-purdue-gold)] hover:bg-[var(--color-purdue-gold-light)] text-black font-semibold text-sm rounded-lg transition-colors"
                >
                  Organizer Dashboard
                </button>
              )}
            </div>

          </div>
          </div>
        )}
      </div>
    </div>
  );
}