import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function CreateClub() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    description: '',
    contactInfo: '',
    category: '',
    organizerId: '',
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
    if (!form.organizerId.trim()) errs.organizerId = 'Organizer ID is required.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await axios.post('/api/clubs', form);
      navigate(`/clubs/${res.data.id}`);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create club.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--color-surface)] text-[var(--color-text-primary)]">

      {/* Header */}
      <div className="flex items-center gap-4 px-8 py-6 border-b border-white/5 shrink-0">
        <button
          onClick={() => navigate('/clubs')}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          ← Back to Clubs
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-8 py-10">
          <div className="mb-8">
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
              name="organizerId"
              value={form.organizerId}
              onChange={handleChange}
              error={errors.organizerId}
              placeholder="Your user ID"
              required
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

function Field({ label, name, value, onChange, error, placeholder, required, multiline }) {
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