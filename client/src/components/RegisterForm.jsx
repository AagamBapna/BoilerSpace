import { useState } from 'react';
import axios from 'axios';
import { setToken } from '../lib/auth';

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];

const inputClass = "w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors";

export default function RegisterForm({ onSuccess, onSwitchToLogin, onNeedVerification }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [major, setMajor] = useState('');
    const [year, setYear] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/auth/register', {
                email,
                password,
                displayName,
                major,
                year,
            });
            onNeedVerification(email, password);
        } catch (err) {
            setError(err.response?.data?.error || 'Something went wrong');
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
                <h1 className="text-xl font-bold text-[#f5f5f5]">Create account</h1>
                <p className="text-sm text-[#a0a0a0] mt-1 mb-6">Join BoilerSpace</p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                        <label htmlFor="reg-name" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Display Name</label>
                        <input
                            id="reg-name"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your name"
                            required
                            className={inputClass}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="reg-email" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Email</label>
                        <input
                            id="reg-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@purdue.edu"
                            required
                            className={inputClass}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="reg-major" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Major</label>
                        <input
                            id="reg-major"
                            type="text"
                            value={major}
                            onChange={(e) => setMajor(e.target.value)}
                            placeholder="e.g. Computer Science"
                            required
                            className={inputClass}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="reg-year" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Year</label>
                        <select
                            id="reg-year"
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            required
                            className={inputClass}
                        >
                            <option value="" disabled>Select year</option>
                            {YEARS.map((y) => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="reg-password" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Password</label>
                        <input
                            id="reg-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Min. 8 characters"
                            required
                            className={inputClass}
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label htmlFor="reg-confirm" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Confirm Password</label>
                        <input
                            id="reg-confirm"
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            placeholder="Repeat password"
                            required
                            className={inputClass}
                        />
                    </div>

                    {error && (
                        <p className="text-xs text-red-400">{error}</p>
                    )}

                    <button
                        id="reg-submit"
                        type="submit"
                        disabled={loading}
                        className="mt-1 w-full py-2.5 rounded-lg bg-gradient-to-r from-[#CEB888] to-[#C28E0E] text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? 'Creating account...' : 'Create account'}
                    </button>
                </form>

                {onSwitchToLogin && (
                    <p className="mt-4 text-center text-xs text-[#a0a0a0]">
                        Already have an account?{' '}
                        <button onClick={onSwitchToLogin} className="text-[#CEB888] hover:underline">Sign in</button>
                    </p>
                )}
            </div>
        </div>
    );
}
