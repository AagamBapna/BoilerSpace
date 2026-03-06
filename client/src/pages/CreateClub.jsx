import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function CreateClub({ user }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    contactInfo: '',
    category: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Club name is required.';
    if (!user?.id) errs.form = 'You must be logged in to create a club.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    setServerError(null);
    try {
      const payload = {
        ...form,
        organizerIds: [user.id],
      };
      const res = await axios.post('/api/clubs', payload);
      navigate(`/clubs/${res.data.id}`, { state: { notice: 'Club created successfully.' } });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create club.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[var(--color-surface-light)] text-[var(--color-text-primary)] py-10 pr-4 pl-8 sm:pr-6 sm:pl-12 md:pr-8 md:pl-16 lg:pr-10 lg:pl-20 xl:pr-12 xl:pl-24">
      <div className="page-top-actions">
        <button onClick={() => navigate('/clubs')} className="profile-button-like">Clubs</button>
        <button onClick={() => navigate('/')} className="profile-button-like">Map</button>
        <button onClick={() => navigate('/announcements')} className="profile-button-like">Announcements</button>
      </div>

      <div className="w-full max-w-[1500px] mx-auto flex flex-col gap-7 pt-14 sm:pt-16">
        <div className="flex flex-col gap-6 max-w-3xl mx-auto w-full">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-purdue-gold)] mb-2">New</p>
            <h1 className="text-4xl font-bold tracking-tight">Create a Club</h1>
          </div>

          {serverError && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <Field
              label="Club Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              error={errors.name}
              placeholder="e.g. Purdue Robotics Club"
              required
            />
            <Field
              label="Description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="What does your club do?"
              multiline
            />
            <Field
              label="Category"
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="e.g. Engineering, Arts, Sports"
            />
            <Field
              label="Contact Info"
              name="contactInfo"
              value={form.contactInfo}
              onChange={handleChange}
              placeholder="e.g. email@purdue.edu"
            />
            <Field
              label="Organizer ID"
              name="organizer"
              value={user?.id || ''}
              onChange={() => {}}
              error={errors.form}
              placeholder="Auto-filled from your account"
              required
              readOnly
            />

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 bg-[var(--color-purdue-gold)] hover:bg-[var(--color-purdue-gold-light)] text-black font-semibold text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Club'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/clubs')}
                className="px-6 py-2.5 bg-white/5 hover:bg-white/10 text-[var(--color-text-secondary)] text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, error, placeholder, required, multiline, readOnly }) {
  const baseClass = `w-full px-4 py-2.5 bg-[var(--color-surface-light)] border rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)]/40 focus:outline-none focus:border-[var(--color-purdue-gold)]/50 transition-colors ${
    error ? 'border-red-500/50' : 'border-white/10'
  }`;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-white/40">
        {label}{required && <span className="text-[var(--color-purdue-gold)] ml-1">*</span>}
      </label>
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={4}
          readOnly={readOnly}
          className={baseClass + ' resize-none'}
        />
      ) : (
        <input
          type="text"
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          className={baseClass}
        />
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}