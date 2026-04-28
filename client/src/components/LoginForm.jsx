import { useState } from 'react';
import axios from 'axios';
import { setToken } from '../lib/auth';

const inputClass = "w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors";

export default function LoginForm({ onSuccess, onSwitchToRegister, onForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      setToken(res.data.token);
      onSuccess(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8"
        style={{ background: '#1e1e1e', border: '1px solid rgba(206,184,136,0.15)', padding: '1rem' }}
      >
        <h1 className="text-xl font-bold text-[#f5f5f5]">Sign in</h1>
        <p className="text-sm text-[#a0a0a0] mt-1 mb-6">Welcome back to BoilerSpace</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="login-email" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@purdue.edu"
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="login-password" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              className={inputClass}
            />
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="mt-1 w-full py-2.5 rounded-lg bg-gradient-to-r from-[#CEB888] to-[#C28E0E] text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {onSwitchToRegister && (
          <p className="mt-4 text-center text-xs text-[#a0a0a0]">
            Don&apos;t have an account?{' '}
            <button onClick={onSwitchToRegister} className="text-[#CEB888] hover:underline">Create account</button>
          </p>
        )}

        {onForgotPassword && (
          <p className="mt-2 text-center text-xs text-[#a0a0a0]">
            Forgot your password?{' '}
            <button onClick={onForgotPassword} className="text-[#CEB888] hover:underline">Reset it</button>
          </p>
        )}
      </div>
    </div>
  );
}
