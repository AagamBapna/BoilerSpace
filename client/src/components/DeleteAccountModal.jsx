import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { clearToken } from '../lib/auth';

const inputClass = "w-full bg-[#111111] border border-[#CEB888]/20 rounded-lg px-3 py-2.5 text-sm text-[#f5f5f5] placeholder-[#555] focus:outline-none focus:border-[#CEB888]/50 transition-colors";
const otpInputClass = "w-14 h-14 bg-[#111111] border border-red-500/30 rounded-lg text-center text-xl font-bold text-[#f5f5f5] focus:outline-none focus:border-red-500/60 transition-colors";

export default function DeleteAccountModal({ userEmail, onDeleted, onClose }) {
    const [step, setStep] = useState('confirm');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef([]);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const requestOtp = async () => {
        setLoading(true);
        setError('');
        try {
            await axios.post('/api/auth/request-delete-otp');
            setStep('otp');
            setResendCooldown(30);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send verification code');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (e) => {
        e.preventDefault();
        if (confirmEmail.toLowerCase() !== userEmail.toLowerCase()) {
            setError('Email does not match your account email');
            return;
        }
        await requestOtp();
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

    const handleDeleteConfirm = async (e) => {
        e.preventDefault();
        const fullCode = code.join('');

        if (fullCode.length !== 6) {
            setError('Please enter the full 6-digit code');
            return;
        }

        setError('');
        setLoading(true);
        try {
            await axios.post('/api/auth/confirm-delete', { code: fullCode });
            clearToken();
            onDeleted();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete account');
            setCode(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-sm mx-4 rounded-2xl p-8"
                style={{ background: '#1e1e1e', border: '1px solid rgba(239,68,68,0.25)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                </div>

                {step === 'confirm' && (
                    <>
                        <h1 className="text-xl font-bold text-[#f5f5f5] text-center">Delete Account</h1>
                        <p className="text-sm text-[#a0a0a0] mt-1 mb-6 text-center">
                            This action is permanent. All your data including notes, check-ins, and bookmarks will be removed. Type your email to confirm.
                        </p>

                        <form onSubmit={handleConfirm} className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <label htmlFor="delete-confirm-email" className="text-xs text-[#a0a0a0] uppercase tracking-wide">Type your email to confirm</label>
                                <input
                                    id="delete-confirm-email"
                                    type="email"
                                    value={confirmEmail}
                                    onChange={(e) => setConfirmEmail(e.target.value)}
                                    placeholder={userEmail}
                                    className={inputClass}
                                />
                            </div>

                            {error && (
                                <p className="text-xs text-red-400">{error}</p>
                            )}

                            <button
                                id="delete-account-confirm"
                                type="submit"
                                disabled={loading || confirmEmail.toLowerCase() !== userEmail.toLowerCase()}
                                className="mt-1 w-full py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Sending code...' : 'Continue with deletion'}
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full py-2.5 rounded-lg text-[#a0a0a0] text-sm hover:text-[#f5f5f5] transition-colors"
                            >
                                Cancel
                            </button>
                        </form>
                    </>
                )}

                {step === 'otp' && (
                    <>
                        <h1 className="text-xl font-bold text-[#f5f5f5] text-center">Verify Deletion</h1>
                        <p className="text-sm text-[#a0a0a0] mt-1 mb-6 text-center">
                            We sent a 6-digit code to <span className="text-red-400">{userEmail}</span>. Enter it to permanently delete your account.
                        </p>

                        <form onSubmit={handleDeleteConfirm} className="flex flex-col gap-4">
                            <div className="flex justify-center gap-2">
                                {code.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => (inputRefs.current[i] = el)}
                                        id={`delete-otp-input-${i}`}
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
                                id="delete-otp-submit"
                                type="submit"
                                disabled={loading || code.join('').length !== 6}
                                className="w-full py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Deleting...' : 'Delete my account permanently'}
                            </button>
                        </form>

                        <div className="mt-4 flex flex-col items-center gap-2">
                            <button
                                onClick={requestOtp}
                                disabled={resendCooldown > 0}
                                className="text-xs text-red-400 hover:underline disabled:opacity-40 disabled:no-underline"
                            >
                                {resendCooldown > 0
                                    ? `Resend code in ${resendCooldown}s`
                                    : 'Resend code'}
                            </button>
                            <button
                                onClick={onClose}
                                className="text-xs text-[#a0a0a0] hover:underline"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
