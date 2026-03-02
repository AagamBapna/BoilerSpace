import { useState } from 'react';
import axios from 'axios';

const inputClass =
  "w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors";

export default function ForgotPasswordForm({ onBackToLogin, onSwitchToReset }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Email is required');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      setMessage(
        res.data?.message ||
          'If an account with that email exists, a password reset link has been sent.'
      );
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process password reset request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8"
        style={{ background: '#1e1e1e', border: '1px solid rgba(206,184,136,0.15)' }}
      >
        <h1 className="text-xl font-bold text-[#f5f5f5]">Forgot password</h1>
        <p className="text-sm text-[#a0a0a0] mt-1 mb-6">Enter your account email to reset your password</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="forgot-email" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Email</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@purdue.edu"
              required
              className={inputClass}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
          {message && <p className="text-xs text-green-400">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full py-2.5 rounded-lg bg-gradient-to-r from-[#CEB888] to-[#C28E0E] text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[#a0a0a0]">
          Remembered your password?{' '}
          <button onClick={onBackToLogin} className="text-[#CEB888] hover:underline">Sign in</button>
        </p>

        {onSwitchToReset && (
          <p className="mt-2 text-center text-xs text-[#a0a0a0]">
            Already have a reset token?{' '}
            <button onClick={onSwitchToReset} className="text-[#CEB888] hover:underline">Reset now</button>
          </p>
        )}
      </div>
    </div>
  );
}
