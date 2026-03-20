import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { setToken } from '../lib/auth';

const inputClass = "w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors";
const otpInputClass = "w-14 h-14 bg-[#111111] border border-[#CEB888]/20 rounded-lg text-center text-xl font-bold text-[#f5f5f5] focus:outline-none focus:border-[#CEB888]/50 transition-colors";

export default function LoginForm({ onSuccess, onSwitchToRegister, onForgotPassword }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

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
      if (res.data.requiresOtp) {
        setOtpEmail(res.data.email);
        setOtpStep(true);
        setResendCooldown(30);
      } else {
        setToken(res.data.token);
        onSuccess(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').split('').slice(0, 6);
      const newCode = [...code];
      digits.forEach((d, i) => {
        if (index + i < 6) newCode[index + i] = d;
      });
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await axios.post('/api/auth/login', { email, password });
      setResendCooldown(30);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code');
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const fullCode = code.join('');

    if (fullCode.length !== 6) {
      setError('Please enter the full 6-digit code');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/verify-login-otp', {
        email: otpEmail,
        code: fullCode,
        password,
      });
      setToken(res.data.token);
      onSuccess(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  if (otpStep) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div
          className="w-full max-w-sm mx-4 rounded-2xl p-8"
          style={{ background: '#1e1e1e', border: '1px solid rgba(206,184,136,0.15)' }}
        >
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#CEB888]/10 flex items-center justify-center">
            <span className="text-2xl">🔐</span>
          </div>

          <h1 className="text-xl font-bold text-[#f5f5f5] text-center">Two-Factor Authentication</h1>
          <p className="text-sm text-[#a0a0a0] mt-1 mb-6 text-center">
            We sent a 6-digit code to <span className="text-[#CEB888]">{otpEmail}</span>
          </p>

          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
            <div className="flex justify-center gap-2">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  id={`login-otp-input-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={otpInputClass}
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center">{error}</p>
            )}

            <button
              id="login-otp-submit"
              type="submit"
              disabled={loading || code.join('').length !== 6}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#CEB888] to-[#C28E0E] text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Sign in'}
            </button>
          </form>

          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-xs text-[#CEB888] hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend code'}
            </button>
            <button
              onClick={() => {
                setOtpStep(false);
                setCode(['', '', '', '', '', '']);
                setError('');
              }}
              className="text-xs text-[#a0a0a0] hover:underline"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm mx-4 rounded-2xl p-8"
        style={{ background: '#1e1e1e', border: '1px solid rgba(206,184,136,0.15)' }}
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
