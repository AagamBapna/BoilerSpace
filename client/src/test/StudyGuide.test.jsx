import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudyGuide from '../components/StudyGuide';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        defaults: { headers: { common: {} } },
    },
}));

import axios from 'axios';

describe('StudyGuide — Rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockResolvedValue({ data: [] });
    });
    test('renders modal with course name', async () => {
        render(<StudyGuide courseId="c001" courseName="CS 40800 — Software Testing" onClose={vi.fn()} />);
        expect(screen.getByText('🤖 AI Study Guide')).toBeInTheDocument();
        expect(screen.getByText('CS 40800 — Software Testing')).toBeInTheDocument();
    });
    test('shows generate button initially', async () => {
        render(<StudyGuide courseId="c001" courseName="Test Course" onClose={vi.fn()} />);
        expect(screen.getByText('Generate Study Guide')).toBeInTheDocument();
    });
    test('calls onClose when close button is clicked', async () => {
        const onClose = vi.fn();
        render(<StudyGuide courseId="c001" courseName="Test" onClose={onClose} />);
        const closeBtn = screen.getByLabelText('Close study guide');
        await userEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalled();
    });
});

describe('StudyGuide — Generation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        axios.get.mockResolvedValue({ data: [] });
    });
    test('shows loading state while generating', async () => {
        axios.post.mockReturnValue(new Promise(() => {}));
        render(<StudyGuide courseId="c001" courseName="Test" onClose={vi.fn()} />);
        await userEvent.click(screen.getByText('Generate Study Guide'));
        expect(screen.getByText('Analyzing notes and generating study guide...')).toBeInTheDocument();
    });
    test('displays generated study guide with markdown', async () => {
        axios.post.mockResolvedValue({
            data: { studyGuide: '## Key Topics\n\n- **Node Coverage**', notesUsed: 5, id: 'sg1' },
        });
        axios.get.mockResolvedValue({ data: [] });
        render(<StudyGuide courseId="c001" courseName="Test" onClose={vi.fn()} />);
        await userEvent.click(screen.getByText('Generate Study Guide'));
        await waitFor(() => {
            expect(screen.getByText('Key Topics')).toBeInTheDocument();
            expect(screen.getByText('Node Coverage')).toBeInTheDocument();
        });
    });
    test('displays error on failure', async () => {
        axios.post.mockRejectedValue({ response: { data: { error: 'No PDF notes found' } } });
        render(<StudyGuide courseId="c001" courseName="Test" onClose={vi.fn()} />);
        await userEvent.click(screen.getByText('Generate Study Guide'));
        await waitFor(() => {
            expect(screen.getByText('No PDF notes found')).toBeInTheDocument();
        });
    });
    test('shows regenerate button after generation', async () => {
        axios.post.mockResolvedValue({
            data: { studyGuide: '## Key Topics\n\nContent here', notesUsed: 3, id: 'sg1' },
        });
        render(<StudyGuide courseId="c001" courseName="Test" onClose={vi.fn()} />);
        await userEvent.click(screen.getByText('Generate Study Guide'));
        await waitFor(() => {
            expect(screen.getByText('↻ Regenerate')).toBeInTheDocument();
        });
    });
});

describe('StudyGuide — History', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    test('shows history button when past guides exist', async () => {
        axios.get.mockResolvedValue({
            data: [
                { _id: 'h1', content: 'Old guide content', notesUsed: 4, createdAt: '2026-03-28T12:00:00Z' },
            ],
        });
        render(<StudyGuide courseId="c001" courseName="Test" onClose={vi.fn()} />);
        await waitFor(() => {
            expect(screen.getByText(/History/)).toBeInTheDocument();
        });
    });
    test('loads study guide from history when clicked', async () => {
        axios.get.mockResolvedValue({
            data: [
                { _id: 'h1', content: '## Loaded from history', notesUsed: 4, createdAt: '2026-03-28T12:00:00Z' },
            ],
        });
        render(<StudyGuide courseId="c001" courseName="Test" onClose={vi.fn()} />);
        await waitFor(() => {
            expect(screen.getByText(/History/)).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText(/History/));
        const historyItem = screen.getByText(/4 chunks used/);
        await userEvent.click(historyItem);
        await waitFor(() => {
            expect(screen.getByText('Loaded from history')).toBeInTheDocument();
        });
    });
});