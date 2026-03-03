import { useEffect, useState } from 'react';
import axios from 'axios';

const inputClass =
  "w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors";

export default function ResetPasswordForm({ onBackToLogin, onSwitchToForgot, initialToken = '' }) {
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
    }
  }, [initialToken]);

  const hasInitialToken = Boolean(initialToken);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const trimmedToken = token.trim();

    if (!trimmedToken || !newPassword) {
      setError('Token and new password are required');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/reset-password', {
        token: trimmedToken,
        newPassword,
      });
      setMessage(res.data?.message || 'Password reset successful');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
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
        <h1 className="text-xl font-bold text-[#f5f5f5]">Reset password</h1>
        <p className="text-sm text-[#a0a0a0] mt-1 mb-6">
          {hasInitialToken ? 'Choose your new password' : 'Enter your reset token and choose a new password'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {!hasInitialToken && (
            <div className="flex flex-col gap-1">
              <label htmlFor="reset-token" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Reset Token</label>
              <input
                id="reset-token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste reset token"
                required
                className={inputClass}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor="reset-password" className="text-xs text-[#a0a0a0] uppercase tracking-wide">New Password</label>
            <input
              id="reset-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="reset-confirm" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Confirm Password</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
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
            {loading ? 'Resetting...' : 'Reset password'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[#a0a0a0]">
          Back to{' '}
          <button onClick={onBackToLogin} className="text-[#CEB888] hover:underline">Sign in</button>
        </p>

        {onSwitchToForgot && (
          <p className="mt-2 text-center text-xs text-[#a0a0a0]">
            Need a token first?{' '}
            <button onClick={onSwitchToForgot} className="text-[#CEB888] hover:underline">Forgot password</button>
          </p>
        )}
      </div>
    </div>
  );
}
