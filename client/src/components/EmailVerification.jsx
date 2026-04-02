import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const inputClass = "w-14 h-14 bg-[#111111] border border-[#CEB888]/20 rounded-lg text-center text-xl font-bold text-[#f5f5f5] focus:outline-none focus:border-[#CEB888]/50 transition-colors";

export default function EmailVerification({ email, onVerified, onBackToLogin }) {
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef([]);
    const hasSentOtp = useRef(false);

    useEffect(() => {
        if (!hasSentOtp.current) {
            hasSentOtp.current = true;
            sendOtp();
        }
    }, []);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const sendOtp = async () => {
        try {
            await axios.post('/api/auth/send-otp', { email });
            setSent(true);
            setResendCooldown(30);
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send verification code');
        }
    };

    const handleChange = (index, value) => {
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

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const fullCode = code.join('');

        if (fullCode.length !== 6) {
            setError('Please enter the full 6-digit code');
            return;
        }

        setError('');
        setLoading(true);
        try {
            await axios.post('/api/auth/verify-otp', { email, code: fullCode });
            onVerified();
        } catch (err) {
            setError(err.response?.data?.error || 'Verification failed');
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
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
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#CEB888]/10 flex items-center justify-center">
                    <span className="text-2xl">Verify</span>
                </div>

                <h1 className="text-xl font-bold text-[#f5f5f5] text-center">Verify your email</h1>
                <p className="text-sm text-[#a0a0a0] mt-1 mb-6 text-center">
                    {sent
                        ? <>We sent a 6-digit code to <span className="text-[#CEB888]">{email}</span></>
                        : 'Sending verification code...'}
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex justify-center gap-2">
                        {code.map((digit, i) => (
                            <input
                                key={i}
                                ref={(el) => (inputRefs.current[i] = el)}
                                id={`otp-input-${i}`}
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={digit}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                className={inputClass}
                                autoFocus={i === 0}
                            />
                        ))}
                    </div>

                    {error && (
                        <p className="text-xs text-red-400 text-center">{error}</p>
                    )}

                    <button
                        id="otp-submit"
                        type="submit"
                        disabled={loading || code.join('').length !== 6}
                        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#CEB888] to-[#C28E0E] text-black font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {loading ? 'Verifying...' : 'Verify email'}
                    </button>
                </form>

                <div className="mt-4 flex flex-col items-center gap-2">
                    <button
                        onClick={sendOtp}
                        disabled={resendCooldown > 0}
                        className="text-xs text-[#CEB888] hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                        {resendCooldown > 0
                            ? `Resend code in ${resendCooldown}s`
                            : 'Resend code'}
                    </button>

                    {onBackToLogin && (
                        <button
                            onClick={onBackToLogin}
                            className="text-xs text-[#a0a0a0] hover:underline"
                        >
                            Back to sign in
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
