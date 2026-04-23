import { useState, useEffect, useMemo } from "react";
import axios from "axios";

const courseColors = ['#6ee7b7', '#818cf8', '#f472b6', '#facc15', '#38bdf8', '#fb923c', '#a78bfa', '#34d399',]

export default function StudyPlanGenerator({ userId, onClose }) {
    const [step, setStep] = useState('form');
    const [userCourses, setUserCourses] = useState([]);
    const [selectedCourses, setSelectedCourses] = useState([]);
    const [preferredStart, setPreferredStart] = useState("09:00");
    const [preferredEnd, setPreferredEnd] = useState("19:00");
    const [busySlots, setBusySlots] = useState([]);
    const [autoImport, setAutoImport] = useState(false);
    const [plan, setPlan] = useState(null);
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [editingBlock, setEditingBlock] = useState(null);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];


    // get user's courses and history on mount
    useEffect(() => {
        axios.get(`/api/users/${userId}/courses`)
            .then((res) => setUserCourses(res.data))
            .catch(() => setUserCourses([]));
    }, [userId]);

    useEffect(() => {
        axios.get('/api/courses/study-plan/history')
            .then((res) => setHistory(res.data))
            .catch(() => setHistory([]));
    }, []);

    // auto import if enabled
    useEffect(() => {
        if (autoImport) {
            axios.get('api/users/me/availability')
                .then((res) => {
                    const imported = (res.data || []).map((slot) => ({
                        day: slot.day,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        label: 'Commitment',
                    }));
                    setBusySlots((prev) => [...prev, ...imported]);
                })
                .catch(() => { });
        }
    }, [autoImport]);

    // Color map for courses
    const colorMap = useMemo(() => {
        const map = {};
        userCourses.forEach((course, index) => {
            map[course._id] = courseColors[index % courseColors.length];
            map[course.courseCode] = courseColors[index % courseColors.length];
        });
        return map;
    }, [userCourses]);

    const toggleCourse = (courseId) => {
        setSelectedCourses((prev) => {
            const exists = prev.find((course) => course.courseId === courseId);
            if (exists) {
                return prev.filter((course) => course.courseId !== courseId);
            }
            return [...prev, { courseId, examDate: '', priority: 'medium' }];
        });
    };

    const updateCourse = (courseId, field, value) => {
        setSelectedCourses((prev) =>
            prev.map((course) =>
                course.courseId === courseId ? { ...course, [field]: value } : course
            )
        );
    };

    const addBusySlot = () => {
        setBusySlots((prev) => [...prev, { day: 'Monday', startTime: '09:00', endTime: '10:00', label: '' }]);
    };

    const updateBusySlot = (index, field, value) => {
        setBusySlots((prev) =>
            prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
        );
    };

    const removeBusySlot = (index) => {
        setBusySlots((prev) => prev.filter((_, i) => i !== index));
    };

    const handleGenerate = async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await axios.post('/api/courses/study-plan/generate', {
                courses: selectedCourses,
                preferredStudyHours: { startTime: preferredStart, endTime: preferredEnd },
                busySlots,
                startDate,
            });
            setPlan(res.data);
            setStep('calendar');
            const historyRes = await axios.get('/api/courses/study-plan/history');
            setHistory(historyRes.data);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to generate study plan");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEdits = async () => {
        if (!plan) {
            return;
        }
        try {
            const res = await axios.put(`/api/courses/study-plan/${plan._id}`, {
                blocks: plan.blocks,
            });
            setPlan(res.data);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to save changes");
        }
    };

    const updateBlock = (index, field, value) => {
        setPlan((prev) => ({
            ...prev,
            blocks: prev.blocks.map((block, i) => (i === index ? { ...block, [field]: value } : block)),
        }));
    };

    const deleteBlock = (index) => {
        setPlan((prev) => ({
            ...prev,
            blocks: prev.blocks.filter((_, i) => i !== index),
        }));
    };

    const addBlock = (day) => {
        setPlan((prev) => ({
            ...prev,
            blocks: [...prev.blocks, { day, startTime: '12:00', endTime: '13:00', courseCode: '', topic: 'New study block' }],
        }));
    };

    const loadPlan = (plan) => {
        setPlan(plan);
        setStep('calendar');
        setShowHistory(false);
    };

    const timeToRow = (time) => {
        const [hour, minute] = time.split(':').map(Number);
        return (hour - 7) * 2 + (minute >= 30 ? 1 : 0);
    };

    const blockHeight = (start, end) => {
        return Math.max(timeToRow(end) - timeToRow(start), 1);
    };

    return (
        <div className="background-blur" onClick={onClose}>
            <div
                className="course-selector"
                style={{ maxWidth: step === 'calendar' ? '960px' : '560px' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                            AI Study Plan
                        </h2>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            {step === 'form' ? 'Configure your study plan' : 'Your study schedule'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {history.length > 0 && (
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors"
                            >
                                📋 History ({history.length})
                            </button>
                        )}
                        {step === 'calendar' && (
                            <button
                                onClick={() => { setStep('form'); setPlan(null); }}
                                className="px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors"
                            >
                                ← Back
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors">
                            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                {/* History Dropdown */}
                {showHistory && (
                    <div className="mb-4 p-3 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)] max-h-[200px] overflow-y-auto">
                        <p className="text-xs text-[var(--color-text-secondary)] mb-2 font-semibold">Previous Study Plans</p>
                        {history.map((p) => (
                            <button key={p._id} onClick={() => loadPlan(p)}
                                className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-lg transition-colors mb-1">
                                {p.title} — {new Date(p.createdAt).toLocaleString()}
                            </button>
                        ))}
                    </div>
                )}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                        {error}
                    </div>
                )}
                {/* ====== FORM VIEW ====== */}
                {step === 'form' && !loading && (
                    <div className="flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
                        {/* Course selection */}
                        <div>
                            <label className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 block">
                                Select Courses & Exam Dates
                            </label>
                            {userCourses.length === 0 ? (
                                <p className="text-xs text-[var(--color-text-secondary)]">No courses enrolled. Add courses in your profile.</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {userCourses.map((course) => {
                                        const sel = selectedCourses.find((c) => c.courseId === course._id);
                                        return (
                                            <div key={course._id} className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!sel}
                                                        onChange={() => toggleCourse(course._id)}
                                                        className="accent-[var(--color-purdue-gold)]"
                                                        id={`course-${course._id}`}
                                                    />
                                                    <label htmlFor={`course-${course._id}`} className="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">
                                                        {course.courseCode} — {course.title}
                                                    </label>
                                                </div>
                                                {sel && (
                                                    <div className="flex items-center gap-3 ml-6">
                                                        <label className="text-xs text-[var(--color-text-secondary)]">Exam:</label>
                                                        <input
                                                            type="date"
                                                            value={sel.examDate}
                                                            onChange={(e) => updateCourse(course._id, 'examDate', e.target.value)}
                                                            className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                                                        />
                                                        <label className="text-xs text-[var(--color-text-secondary)]">Priority:</label>
                                                        <select
                                                            value={sel.priority}
                                                            onChange={(e) => updateCourse(course._id, 'priority', e.target.value)}
                                                            className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
                                                        >
                                                            <option value="low">Low</option>
                                                            <option value="medium">Medium</option>
                                                            <option value="high">High</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 block">Start Date</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"/>
                        </div>
                        {/* Preferred study hours */}
                        <div>
                            <label className="text-sm font-semibold text-[var(--color-text-primary)] mb-2 block">
                                Preferred Study Hours
                            </label>
                            <div className="flex items-center gap-2">
                                <input type="time" value={preferredStart} onChange={(e) => setPreferredStart(e.target.value)}
                                    className="px-2 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
                                <span className="text-xs text-[var(--color-text-secondary)]">to</span>
                                <input type="time" value={preferredEnd} onChange={(e) => setPreferredEnd(e.target.value)}
                                    className="px-2 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]" />
                            </div>
                        </div>
                        {/* Busy slots */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-[var(--color-text-primary)]">Busy Slots (classes, work, etc.)</label>
                                <button onClick={addBusySlot} className="text-xs text-[var(--color-purdue-gold)] hover:underline">+ Add slot</button>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <input type="checkbox" id="autoImport" checked={autoImport} onChange={(e) => setAutoImport(e.target.checked)}
                                    className="accent-[var(--color-purdue-gold)]" />
                                <label htmlFor="autoImport" className="text-xs text-[var(--color-text-secondary)] cursor-pointer">
                                    Auto-import my saved availability as busy times
                                </label>
                            </div>
                            {busySlots.map((slot, i) => (
                                <div key={i} className="flex items-center gap-2 mb-2">
                                    <select value={slot.day} onChange={(e) => updateBusySlot(i, 'day', e.target.value)}
                                        className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)]">
                                        {days.map((d) => <option key={d} value={d}>{d.slice(0, 3)}</option>)}
                                    </select>
                                    <input type="time" value={slot.startTime} onChange={(e) => updateBusySlot(i, 'startTime', e.target.value)}
                                        className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)]" />
                                    <span className="text-xs text-[var(--color-text-secondary)]">to</span>
                                    <input type="time" value={slot.endTime} onChange={(e) => updateBusySlot(i, 'endTime', e.target.value)}
                                        className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)]" />
                                    <input type="text" placeholder="Label" value={slot.label} onChange={(e) => updateBusySlot(i, 'label', e.target.value)}
                                        className="px-2 py-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] flex-1" />
                                    <button onClick={() => removeBusySlot(i)} className="text-red-400 hover:text-red-300 text-xs p-1">✕</button>
                                </div>
                            ))}
                        </div>
                        {/* Generate button */}
                        <button
                            onClick={handleGenerate}
                            disabled={selectedCourses.length === 0 || selectedCourses.some((c) => !c.examDate)}
                            className="w-full py-2.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            Generate Study Plan
                        </button>
                    </div>
                )}
                {/* Loading */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="w-6 h-6 rounded-full border-2 border-[var(--color-purdue-gold)]/20 border-t-[var(--color-purdue-gold)] animate-spin" />
                        <p className="text-sm text-[var(--color-text-secondary)]">Generating your study plan...</p>
                    </div>
                )}
                {/* ====== CALENDAR VIEW ====== */}
                {step === 'calendar' && plan && (() => {
                    const dateSet = new Set(plan.blocks.map(b => b.day));
                    const sortedDates = [...dateSet].sort();
                    const formatDate = (dateStr) => {
                        const d = new Date(dateStr + 'T12:00:00');
                        const dayName = d.toLocaleDateString('en-US', {weekday: 'short'});
                        return `${dayName} ${d.getMonth() + 1}/${d.getDate()}`;
                    };
                    return (
                        <div className="flex flex-col gap-4">
                            {/* Calendar grid */}
                            <div className="overflow-x-auto">
                                <div className="study-plan-grid" style={{ minWidth: '700px', gridTemplateColumns: `60px repeat(${sortedDates.length}, 1fr)` }}>
                                    {/* Header row */}
                                    <div className="study-plan-header-cell" />
                                    {sortedDates.map((date) => (
                                        <div key={date} className="study-plan-header-cell">
                                            {formatDate(date)}
                                        </div>
                                    ))}
                                    {/* Time rows: 7:00 to 22:00 */}
                                    {Array.from({ length: 30 }, (_, i) => {
                                        const hour = 7 + Math.floor(i / 2);
                                        const min = i % 2 === 0 ? '00' : '30';
                                        const timeLabel = `${hour.toString().padStart(2, '0')}:${min}`;
                                        return (
                                            <div key={i} className="contents">
                                                <div className="study-plan-time-label">{i % 2 === 0 ? timeLabel : ''}</div>
                                                {sortedDates.map((date) => {
                                                    const blocksHere = plan.blocks.filter(
                                                        (b) => b.day === date && timeToRow(b.startTime) === i
                                                    );
                                                    const busyHere = (plan.busySlots || []).filter(
                                                        (s) => s.day === date && timeToRow(s.startTime) === i
                                                    );
                                                    return (
                                                        <div key={date} className="study-plan-cell" onClick={() => addBlock(date)}>
                                                            {blocksHere.map((block) => {
                                                                const bIdx = plan.blocks.indexOf(block);
                                                                const color = colorMap[block.courseCode] || colorMap[block.courseId?._id] || '#818cf8';
                                                                const height = blockHeight(block.startTime, block.endTime);
                                                                return (
                                                                    <div
                                                                        key={bIdx}
                                                                        className="study-plan-block"
                                                                        style={{
                                                                            background: color + '22',
                                                                            borderLeft: `3px solid ${color}`,
                                                                            height: `${height * 28}px`,
                                                                            zIndex: 2,
                                                                        }}
                                                                        onClick={(e) => { e.stopPropagation(); setEditingBlock(bIdx); }}
                                                                    >
                                                                        <div style={{ fontSize: '10px', fontWeight: 600, color }}>{block.courseCode}</div>
                                                                        <div style={{ fontSize: '9px', color: 'var(--color-text-secondary)' }}>{block.topic}</div>
                                                                        <div style={{ fontSize: '9px', color: 'var(--color-text-secondary)' }}>
                                                                            {block.startTime}–{block.endTime}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {busyHere.map((slot, si) => {
                                                                const height = blockHeight(slot.startTime, slot.endTime);
                                                                return (
                                                                    <div key={`busy-${si}`} className="study-plan-block busy"
                                                                        style={{ height: `${height * 28}px`, zIndex: 1 }}
                                                                        onClick={(e) => e.stopPropagation()}>
                                                                        <div style={{ fontSize: '9px' }}>{slot.label || 'Busy'}</div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* Block editor */}
                            {editingBlock !== null && plan.blocks[editingBlock] && (
                                <div className="p-4 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-border)]">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Edit Block</h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => { deleteBlock(editingBlock); setEditingBlock(null); }}
                                                className="text-xs text-red-400 hover:underline">Delete</button>
                                            <button onClick={() => setEditingBlock(null)}
                                                className="text-xs text-[var(--color-text-secondary)] hover:underline">Done</button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <input type="date" value={plan.blocks[editingBlock].day}
                                            onChange={(e) => updateBlock(editingBlock, 'day', e.target.value)}
                                            className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)]" />
                                        <input type="time" value={plan.blocks[editingBlock].startTime}
                                            onChange={(e) => updateBlock(editingBlock, 'startTime', e.target.value)}
                                            className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)]" />
                                        <input type="time" value={plan.blocks[editingBlock].endTime}
                                            onChange={(e) => updateBlock(editingBlock, 'endTime', e.target.value)}
                                            className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)]" />
                                        <input type="text" value={plan.blocks[editingBlock].topic}
                                            onChange={(e) => updateBlock(editingBlock, 'topic', e.target.value)}
                                            placeholder="Topic"
                                            className="px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-xs text-[var(--color-text-primary)] flex-1" />
                                    </div>
                                </div>
                            )}
                            {/* Action buttons */}
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={handleSaveEdits}
                                    className="px-4 py-2 text-xs font-semibold bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black rounded-lg hover:opacity-90 transition-opacity">
                                    Save Changes
                                </button>
                                <button onClick={() => { setStep('form'); setPlan(null); }}
                                    className="px-4 py-2 text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-elevated)] transition-colors">
                                    ↻ Regenerate
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}