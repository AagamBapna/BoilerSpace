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
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    contactInfo: '',
    category: '',
  });

  useEffect(() => {
    axios.get(`/api/clubs/${id}`)
      .then(res => setClub(res.data))
      .catch(err => {
        if (err.response?.status === 404) setError('Club not found.');
        else setError('Failed to load club.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!club) return;
    setForm({
      name: club.name || '',
      description: club.description || '',
      contactInfo: club.contactInfo || '',
      category: club.category || '',
    });
  }, [club]);

  const isOrganizer = Boolean(
    user?.id && Array.isArray(club?.organizerIds) && club.organizerIds.map(String).includes(String(user.id))
  );

  const handleEditClick = () => {
    setSaveError(null);
    if (!isOrganizer) {
      setSaveError('You do not have permission to edit this club.');
      return;
    }
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!user?.id) {
      setSaveError('You must be logged in to edit this club.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await axios.patch(`/api/clubs/${id}`, form, {
        headers: { 'X-User-Id': user.id },
      });
      setClub(res.data);
      setEditMode(false);
      setNotice('Club profile updated successfully.');
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to update club.');
    } finally {
      setSaving(false);
    }
  };

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

            {notice && (
              <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-300">
                {notice}
              </div>
            )}

            {saveError && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {saveError}
              </div>
            )}

            {/* Category + Name */}
            <div>
              {editMode ? (
                <input
                  type="text"
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="Category"
                  className="mb-3 w-full max-w-xs px-3 py-2 rounded-lg bg-[var(--color-surface-light)] border border-white/10 text-sm"
                />
              ) : (
                club.category && (
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-purdue-gold)] mb-2">
                  {club.category}
                </p>
                )
              )}
              {editMode ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-surface-light)] border border-white/10 text-2xl font-semibold"
                />
              ) : (
                <h1 className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">
                  {club.name}
                </h1>
              )}
            </div>

            <div className="h-px bg-white/5" />

            {/* Description */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/20 mb-2">About</p>
              {editMode ? (
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-[var(--color-surface-light)] border border-white/10 text-sm"
                />
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {club.description || 'No description available.'}
                </p>
              )}
            </div>

            <div className="h-px bg-white/5" />

            {/* Meta */}
            <div className="flex flex-col gap-4">
              {(club.contactInfo || editMode) && (
                <div className="flex gap-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/20 w-20 shrink-0 pt-px">Contact</span>
                  {editMode ? (
                    <input
                      type="text"
                      value={form.contactInfo}
                      onChange={(e) => setForm((prev) => ({ ...prev, contactInfo: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-surface-light)] border border-white/10 text-sm"
                    />
                  ) : (
                    <span className="text-sm text-[var(--color-text-secondary)]">{club.contactInfo}</span>
                  )}
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
              {!editMode ? (
                <>
                  <button
                    onClick={handleEditClick}
                    className="px-5 py-2.5 bg-[var(--color-purdue-gold)] hover:bg-[var(--color-purdue-gold-light)] text-black font-semibold text-sm rounded-lg transition-colors"
                  >
                    Edit Club
                  </button>
                  {isOrganizer && (
                    <button
                      onClick={() => navigate(`/clubs/${id}/dashboard`)}
                      className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-[var(--color-text-primary)] text-sm rounded-lg transition-colors"
                    >
                      Organizer Dashboard
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-5 py-2.5 bg-[var(--color-purdue-gold)] hover:bg-[var(--color-purdue-gold-light)] text-black font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setSaveError(null);
                    }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-[var(--color-text-secondary)] text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}