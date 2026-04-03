import { useState } from 'react';
import axios from 'axios';
import { formatRelative } from '../utils/formatRelative';

/**
 * Dropdown/popover for authenticated users to report cafe/vending presence.
 * Shows current aggregated scores and lets users submit reports.
 */
export default function SnackReporter({ buildingId, snackData, user, onUpdate, onClose }) {
    const [loading, setLoading] = useState(null); // 'cafe-true' | 'cafe-false' | etc.
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const submit = async (type, value) => {
        if (!user) {
            setError('Sign in to report');
            return;
        }
        const key = `${type}-${value}`;
        setLoading(key);
        setError('');
        setSuccess('');
        try {
            const res = await axios.post(`/api/buildings/${buildingId}/snacks`, { type, value });
            onUpdate?.(res.data);
            setSuccess(`Reported ${type} as ${value ? 'present' : 'not present'}`);
        } catch (err) {
            if (err.response?.status === 409) {
                setError(err.response.data.error || 'You recently reported this');
            } else {
                setError(err.response?.data?.error || 'Failed to submit report');
            }
        } finally {
            setLoading(null);
        }
    };

    const cafe = snackData?.cafeScore ?? 0;
    const vending = snackData?.vendingScore ?? 0;
    const cafeCount = snackData?.cafeCount ?? 0;
    const vendingCount = snackData?.vendingCount ?? 0;

    return (
        <div
            style={{
                background: '#1a1a1a',
                border: '1px solid rgba(206,184,136,0.2)',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '8px',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Snack Availability
                </h4>
                <button
                    onClick={onClose}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors"
                    style={{ padding: '2px 6px' }}
                >
                    x
                </button>
            </div>

            {/* Cafe row */}
            <div style={{ marginBottom: '10px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        Cafe
                        {cafeCount > 0 && (
                            <span style={{ marginLeft: '6px', color: cafe >= 60 ? 'var(--color-status-open)' : 'var(--color-text-secondary)' }}>
                                {cafe}% ({cafeCount} reports)
                            </span>
                        )}
                        {cafeCount === 0 && <span style={{ marginLeft: '6px', opacity: 0.5 }}>No reports</span>}
                    </span>
                </div>
                <div className="flex" style={{ gap: '6px' }}>
                    <button
                        onClick={() => submit('cafe', true)}
                        disabled={loading !== null}
                        className="text-xs"
                        style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(34,197,94,0.3)',
                            background: loading === 'cafe-true' ? 'rgba(34,197,94,0.2)' : 'transparent',
                            color: 'var(--color-status-open)',
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'background 0.15s',
                        }}
                    >
                        {loading === 'cafe-true' ? '...' : 'Present'}
                    </button>
                    <button
                        onClick={() => submit('cafe', false)}
                        disabled={loading !== null}
                        className="text-xs"
                        style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: loading === 'cafe-false' ? 'rgba(239,68,68,0.2)' : 'transparent',
                            color: 'var(--color-status-busy)',
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'background 0.15s',
                        }}
                    >
                        {loading === 'cafe-false' ? '...' : 'Not present'}
                    </button>
                </div>
            </div>

            {/* Vending row */}
            <div style={{ marginBottom: '10px' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '6px' }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        Vending
                        {vendingCount > 0 && (
                            <span style={{ marginLeft: '6px', color: vending >= 60 ? 'var(--color-status-open)' : 'var(--color-text-secondary)' }}>
                                {vending}% ({vendingCount} reports)
                            </span>
                        )}
                        {vendingCount === 0 && <span style={{ marginLeft: '6px', opacity: 0.5 }}>No reports</span>}
                    </span>
                </div>
                <div className="flex" style={{ gap: '6px' }}>
                    <button
                        onClick={() => submit('vending', true)}
                        disabled={loading !== null}
                        className="text-xs"
                        style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(34,197,94,0.3)',
                            background: loading === 'vending-true' ? 'rgba(34,197,94,0.2)' : 'transparent',
                            color: 'var(--color-status-open)',
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'background 0.15s',
                        }}
                    >
                        {loading === 'vending-true' ? '...' : 'Present'}
                    </button>
                    <button
                        onClick={() => submit('vending', false)}
                        disabled={loading !== null}
                        className="text-xs"
                        style={{
                            padding: '4px 12px',
                            borderRadius: '6px',
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: loading === 'vending-false' ? 'rgba(239,68,68,0.2)' : 'transparent',
                            color: 'var(--color-status-busy)',
                            cursor: loading ? 'wait' : 'pointer',
                            transition: 'background 0.15s',
                        }}
                    >
                        {loading === 'vending-false' ? '...' : 'Not present'}
                    </button>
                </div>
            </div>

            {/* Recent reports */}
            {snackData?.recentReports?.length > 0 && (
                <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)', marginBottom: '4px', opacity: 0.7 }}>
                        Recent reports
                    </p>
                    {snackData.recentReports.slice(0, 3).map((r, i) => (
                        <p key={i} className="text-xs" style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}>
                            {r.type}: {r.value ? 'present' : 'not present'} - {formatRelative(r.createdAt)}
                        </p>
                    ))}
                </div>
            )}

            {/* Feedback messages */}
            {error && (
                <p className="text-xs" style={{ color: 'var(--color-status-busy)', marginTop: '8px' }}>{error}</p>
            )}
            {success && (
                <p className="text-xs" style={{ color: 'var(--color-status-open)', marginTop: '8px' }}>{success}</p>
            )}
        </div>
    );
}
