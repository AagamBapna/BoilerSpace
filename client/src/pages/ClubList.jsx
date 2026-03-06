import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import SearchBar from '../components/SearchBar';

export default function ClubList({ user }) {
  const [clubs, setClubs] = useState([]);
  const [filteredClubs, setFilteredClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showMyClubsOnly, setShowMyClubsOnly] = useState(false);
  const [memberClubIds, setMemberClubIds] = useState(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    contactInfo: '',
    category: '',
  });
  const [createErrors, setCreateErrors] = useState({});
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createServerError, setCreateServerError] = useState(null);
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

  useEffect(() => {
    if (!user?.id) {
      setMemberClubIds(new Set());
      return;
    }

    axios.get(`/api/users/${user.id}`)
      .then((res) => {
        const joined = Array.isArray(res.data?.clubIds) ? res.data.clubIds.map(String) : [];
        setMemberClubIds(new Set(joined));
      })
      .catch(() => {
        setMemberClubIds(new Set());
      });
  }, [user?.id]);

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

  const handleOpenCreateModal = useCallback(() => {
    setShowCreateModal(true);
    setCreateForm({ name: '', description: '', contactInfo: '', category: '' });
    setCreateErrors({});
    setCreateServerError(null);
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    if (createSubmitting) return;
    setShowCreateModal(false);
  }, [createSubmitting]);

  const handleCreateFieldChange = useCallback((e) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
    setCreateErrors((prev) => ({ ...prev, [name]: null }));
  }, []);

  const validateCreateForm = useCallback(() => {
    const errs = {};
    if (!createForm.name.trim()) errs.name = 'Club name is required.';
    if (!createForm.description.trim()) errs.description = 'Description is required.';
    if (!createForm.category.trim()) errs.category = 'Category is required.';
    if (!createForm.contactInfo.trim()) errs.contactInfo = 'Contact info is required.';
    if (!user?.id) errs.form = 'You must be logged in to create a club.';
    return errs;
  }, [createForm, user?.id]);

  const handleCreateClub = useCallback(async (e) => {
    e.preventDefault();
    const errs = validateCreateForm();
    if (Object.keys(errs).length) {
      setCreateErrors(errs);
      return;
    }

    setCreateSubmitting(true);
    setCreateServerError(null);
    try {
      const payload = {
        ...createForm,
        organizerIds: [user.id],
      };
      const res = await axios.post('/api/clubs', payload);
      setShowCreateModal(false);
      navigate(`/clubs/${res.data.id}`, { state: { notice: 'Club created successfully.' } });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create club.';
      setCreateServerError(msg);
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, user?.id, navigate, validateCreateForm]);

  const displayedClubs = useMemo(() => {
    if (!showMyClubsOnly) return filteredClubs;
    const userId = String(user?.id || user?._id || '');

    return filteredClubs.filter((club) => {
      const organizerIds = Array.isArray(club.organizerIds) ? club.organizerIds.map(String) : [];
      const clubId = String(club.id || club._id || '');
      return organizerIds.includes(userId) || memberClubIds.has(clubId);
    });
  }, [filteredClubs, showMyClubsOnly, user?.id, user?._id, memberClubIds]);

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 pr-4 pl-8 sm:pr-6 sm:pl-12 md:pr-8 md:pl-16 lg:pr-10 lg:pl-20 xl:pr-12 xl:pl-24">
      <div className="page-top-actions">
        <button
          onClick={handleOpenCreateModal}
          className="profile-button-like profile-button-gold"
        >
          + Create Club
        </button>
        <button
          type="button"
          onClick={() => setShowMyClubsOnly((prev) => !prev)}
          className={`profile-button-like ${
            showMyClubsOnly
              ? 'bg-[var(--color-purdue-gold)] text-black border-transparent hover:bg-[var(--color-purdue-gold-light)]'
              : ''
          }`}
        >
          My Clubs
        </button>
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/activity')} className="profile-button-like">Activity</button>
      </div>

      <div className="w-full max-w-[1500px] mx-auto flex flex-col gap-7">

        {/* Header */}
        <div className="rounded-2xl bg-[var(--color-surface-light)] p-7 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Clubs</h1>
                {!loading && !error && (
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {displayedClubs.length} club{displayedClubs.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--color-purdue-gold)]">Community Directory</p>
            </div>
          </div>
        </div>

        {/* Search */}
        {!loading && !error && clubs.length > 0 && (
          <div className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7">
            <SearchBar
              buildings={clubsForSearch}
              onSelectBuilding={handleSelectClub}
              onSearchChange={handleSearchChange}
            />
          </div>
        )}

        {/* Body */}
        <div className="rounded-2xl bg-[var(--color-surface-light)] p-6 sm:p-7 min-h-[340px] ml-8 sm:ml-12 md:ml-16 lg:ml-20">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
              <p className="text-sm text-[var(--color-text-secondary)]">Loading clubs...</p>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-[var(--color-text-secondary)]">{error}</p>
            </div>
          )}

          {!loading && !error && displayedClubs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {clubs.length === 0
                  ? 'No clubs yet.'
                  : showMyClubsOnly
                    ? 'You are not in any clubs yet, or none match your search.'
                    : 'No clubs match your search.'}
              </p>
              {clubs.length === 0 && (
                <button
                  onClick={handleOpenCreateModal}
                  className="text-xs text-[var(--color-purdue-gold)] hover:underline"
                >
                  Create the first one →
                </button>
              )}
            </div>
          )}

          {!loading && !error && displayedClubs.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
              {displayedClubs.map(club => (
                <button
                  key={club.id}
                  onClick={() => navigate(`/clubs/${club.id}`)}
                  className="group rounded-xl bg-[var(--color-surface-light)] hover:bg-[var(--color-surface-hover)] transition-colors text-left p-3"
                >
                  <div className="h-full rounded-lg px-4 py-3.5 flex flex-col gap-2">
                    {club.category && (
                      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-purdue-gold)]">
                        {club.category}
                      </span>
                    )}
                    <h2 className="font-semibold text-base text-[var(--color-text-primary)] leading-tight">
                      {club.name}
                    </h2>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-normal line-clamp-3 flex-1">
                      {club.description || 'No description available.'}
                    </p>
                    <span className="text-xs text-[var(--color-text-secondary)]/40 group-hover:text-[var(--color-purdue-gold)] transition-colors pt-0.5">
                      View details →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="background-blur">
          <div className="course-selector">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-purdue-gold)] mb-2">New</p>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Create a Club</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseCreateModal}
                className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {createServerError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {createServerError}
              </div>
            )}
            {createErrors.form && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {createErrors.form}
              </div>
            )}

            <div className="mb-6 p-4 bg-[var(--color-surface-light)] rounded-xl">
              <form onSubmit={handleCreateClub} className="flex flex-col gap-4">
                <CreateField
                  label="Club Name"
                  name="name"
                  value={createForm.name}
                  onChange={handleCreateFieldChange}
                  error={createErrors.name}
                  placeholder="e.g. Purdue Robotics Club"
                  required
                />
                <CreateField
                  label="Description"
                  name="description"
                  value={createForm.description}
                  onChange={handleCreateFieldChange}
                  error={createErrors.description}
                  placeholder="What does your club do?"
                  required
                  multiline
                />
                <CreateField
                  label="Category"
                  name="category"
                  value={createForm.category}
                  onChange={handleCreateFieldChange}
                  error={createErrors.category}
                  placeholder="e.g. Engineering, Arts, Sports"
                  required
                />
                <CreateField
                  label="Contact Info"
                  name="contactInfo"
                  value={createForm.contactInfo}
                  onChange={handleCreateFieldChange}
                  error={createErrors.contactInfo}
                  placeholder="e.g. email@purdue.edu"
                  required
                />

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseCreateModal}
                    className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="px-4 py-2 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {createSubmitting ? 'Creating...' : 'Create Club'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateField({ label, name, value, onChange, error, placeholder, required, multiline }) {
  const baseClass = `w-full px-3 py-2 bg-[var(--color-surface)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none transition-colors ${
    error ? 'ring-1 ring-red-500/60' : 'focus:ring-1 focus:ring-[var(--color-purdue-gold)]'
  }`;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-[var(--color-text-secondary)] mb-1 block">
        {label}{required && <span className="text-[var(--color-purdue-gold)] ml-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={4}
          className={baseClass + ' resize-none'}
        />
      ) : (
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={baseClass}
        />
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}