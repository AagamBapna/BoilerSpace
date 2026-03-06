import { useState, useRef } from 'react';
import axios from 'axios';

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE = 16 * 1024 * 1024;

export default function NoteUploadForm({ courseId, onUploadSuccess, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const validateFile = (f) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return 'Invalid file type. Only PDF, PNG, and JPEG files are allowed.';
    }
    if (f.size > MAX_SIZE) {
      return 'File size exceeds the 16MB limit.';
    }
    return null;
  };

  const handleFileSelect = (f) => {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title || file.name);
    formData.append('description', description);

    try {
      const res = await axios.post(`/api/courses/${courseId}/notes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploadSuccess(res.data);
    } catch (err) {
      console.error('Failed to upload note:', err);
      setError(err.response?.data?.error || 'Failed to upload note.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragOver
            ? 'border-[var(--color-purdue-gold)] bg-[var(--color-purdue-gold)]/5'
            : file
              ? 'border-green-500/30 bg-green-500/5'
              : 'border-[var(--color-border)] hover:border-[var(--color-purdue-gold)]/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => e.target.files[0] && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
        {file ? (
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-text-primary)] truncate">{file.name}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">{formatFileSize(file.size)}</p>
            </div>
          </div>
        ) : (
          <>
            <svg className="w-8 h-8 text-[var(--color-text-secondary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Drop a file here or <span className="text-[var(--color-purdue-gold)]">browse</span>
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              PDF, PNG, or JPEG up to 16MB
            </p>
          </>
        )}
      </div>

      {/* Title */}
      <div className="flex flex-col gap-1">
        <label htmlFor="note-title" className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
          Title
        </label>
        <input
          id="note-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Lecture 5 Notes"
          maxLength={200}
          className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]/50 transition-colors"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label htmlFor="note-desc" className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">
          Description <span className="normal-case">(optional)</span>
        </label>
        <textarea
          id="note-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this note..."
          maxLength={1000}
          rows={3}
          className="w-full bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]/50 transition-colors resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--color-border)]">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading || !file}
          className="px-5 py-2 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload Note'}
        </button>
      </div>
    </form>
  );
}
