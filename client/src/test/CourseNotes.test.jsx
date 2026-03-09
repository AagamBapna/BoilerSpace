import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CourseNotes from '../components/CourseNotes';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        delete: vi.fn(),
        defaults: { headers: { common: {} } },
    },
}));

import axios from 'axios';

// ─── Sample data ──────────────────────────────────────────────────────────────

const sampleNotes = [
    {
        _id: 'n001',
        title: 'Lecture 1 Notes',
        description: 'Introduction to software engineering',
        fileUrl: '/uploads/123-lecture1.pdf',
        fileName: 'lecture1.pdf',
        fileSize: 204800,
        fileType: 'application/pdf',
        createdAt: '2026-02-10T10:00:00.000Z',
        uploadedBy: { _id: 'u001', displayName: 'Note Tester', email: 'noter@purdue.edu' },
        courseId: { _id: 'c001', courseCode: 'CS 30700', title: 'Software Engineering I' },
    },
    {
        _id: 'n002',
        title: 'Chapter 2 Diagram',
        description: '',
        fileUrl: '/uploads/456-diagram.png',
        fileName: 'diagram.png',
        fileSize: 512000,
        fileType: 'image/png',
        createdAt: '2026-02-08T14:00:00.000Z',
        uploadedBy: { _id: 'u002', displayName: 'Other User', email: 'other@purdue.edu' },
        courseId: { _id: 'c001', courseCode: 'CS 30700', title: 'Software Engineering I' },
    },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CourseNotes — Loading & Display', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('shows loading spinner while fetching notes', () => {
        axios.get.mockReturnValue(new Promise(() => {}));
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        expect(screen.getByText('Loading notes...')).toBeInTheDocument();
    });

    test('shows error message when fetch fails', async () => {
        axios.get.mockRejectedValueOnce(new Error('Network Error'));
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('Failed to load notes.')).toBeInTheDocument();
        });
    });

    test('shows empty state when no notes exist', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('No notes uploaded yet.')).toBeInTheDocument();
        });
    });

    test('displays notes with title, uploader, and file size', async () => {
        axios.get.mockResolvedValueOnce({ data: sampleNotes });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('Lecture 1 Notes')).toBeInTheDocument();
        });
        expect(screen.getByText('Chapter 2 Diagram')).toBeInTheDocument();
        expect(screen.getByText('Note Tester')).toBeInTheDocument();
        expect(screen.getByText('Other User')).toBeInTheDocument();
        expect(screen.getByText('200.0 KB')).toBeInTheDocument();
        expect(screen.getByText('500.0 KB')).toBeInTheDocument();
    });

    test('displays course name in header', async () => {
        axios.get.mockResolvedValueOnce({ data: sampleNotes });
        render(<CourseNotes courseId="c001" courseName="CS 30700 — Software Engineering I" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('CS 30700 — Software Engineering I')).toBeInTheDocument();
        });
        expect(screen.getByText('Course Notes')).toBeInTheDocument();
    });

    test('shows description when present', async () => {
        axios.get.mockResolvedValueOnce({ data: sampleNotes });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('Introduction to software engineering')).toBeInTheDocument();
        });
    });

    test('shows date and time timestamp for each note', async () => {
        axios.get.mockResolvedValueOnce({ data: sampleNotes });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);

        await waitFor(() => {
            expect(screen.getByText('Lecture 1 Notes')).toBeInTheDocument();
        });

        const expectedTs = new Date(sampleNotes[0].createdAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
        expect(screen.getByText(expectedTs)).toBeInTheDocument();
    });
});

describe('CourseNotes — Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('calls onClose when close button is clicked', async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={onClose} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('No notes uploaded yet.')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'Close course notes' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('shows delete button only for own notes', async () => {
        axios.get.mockResolvedValueOnce({ data: sampleNotes });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('Lecture 1 Notes')).toBeInTheDocument();
        });

        // Should have 1 delete button (for u001's note), not 2
        const deleteButtons = screen.getAllByTitle('Delete');
        expect(deleteButtons).toHaveLength(1);
    });

    test('shows download button for all notes', async () => {
        axios.get.mockResolvedValueOnce({ data: sampleNotes });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('Lecture 1 Notes')).toBeInTheDocument();
        });

        const downloadButtons = screen.getAllByTitle('Download');
        expect(downloadButtons).toHaveLength(2);
    });

    test('downloads note file through authenticated API request', async () => {
        const user = userEvent.setup();
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
        axios.get
            .mockResolvedValueOnce({ data: sampleNotes })
            .mockResolvedValueOnce({ headers: { location: 'https://storage.googleapis.com/test.pdf' } });

        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('Lecture 1 Notes')).toBeInTheDocument();
        });
        await user.click(screen.getAllByTitle('Download')[0]);

        expect(axios.get).toHaveBeenLastCalledWith('/api/notes/n001/download', { maxRedirects: 0, validateStatus: expect.any(Function), });
        expect(window.open).toHaveBeenCalled();
        openSpy.mockRestore();
    });

    test('deletes a note after confirmation', async () => {
        const user = userEvent.setup();
        axios.get.mockResolvedValueOnce({ data: [sampleNotes[0]] });
        axios.delete.mockResolvedValueOnce({ data: { message: 'Note deleted successfully.' } });
        window.confirm = vi.fn(() => true);

        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('Lecture 1 Notes')).toBeInTheDocument();
        });

        const deleteButton = screen.getByTitle('Delete');
        await user.click(deleteButton);

        expect(window.confirm).toHaveBeenCalled();
        expect(axios.delete).toHaveBeenCalledWith('/api/notes/n001');
        await waitFor(() => {
            expect(screen.queryByText('Lecture 1 Notes')).not.toBeInTheDocument();
        });
    });

    test('does not delete when confirmation is cancelled', async () => {
        const user = userEvent.setup();
        axios.get.mockResolvedValueOnce({ data: [sampleNotes[0]] });
        window.confirm = vi.fn(() => false);

        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('Lecture 1 Notes')).toBeInTheDocument();
        });

        const deleteButton = screen.getByTitle('Delete');
        await user.click(deleteButton);

        expect(window.confirm).toHaveBeenCalled();
        expect(axios.delete).not.toHaveBeenCalled();
        expect(screen.getByText('Lecture 1 Notes')).toBeInTheDocument();
    });
});

describe('CourseNotes — Upload Form Toggle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('shows upload button in header', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('+ Upload')).toBeInTheDocument();
        });
    });

    test('shows upload form when upload button is clicked', async () => {
        const user = userEvent.setup();
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('+ Upload')).toBeInTheDocument();
        });

        await user.click(screen.getByText('+ Upload'));
        expect(screen.getByText('Upload a Note')).toBeInTheDocument();
        expect(screen.getByText('Upload Note')).toBeInTheDocument();
    });

    test('hides upload button when form is open', async () => {
        const user = userEvent.setup();
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('+ Upload')).toBeInTheDocument();
        });

        await user.click(screen.getByText('+ Upload'));
        expect(screen.queryByText('+ Upload')).not.toBeInTheDocument();
    });

    test('hides upload form when cancel is clicked', async () => {
        const user = userEvent.setup();
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<CourseNotes courseId="c001" courseName="CS 30700" onClose={vi.fn()} userId="u001" />);
        await waitFor(() => {
            expect(screen.getByText('+ Upload')).toBeInTheDocument();
        });

        await user.click(screen.getByText('+ Upload'));
        expect(screen.getByText('Upload a Note')).toBeInTheDocument();

        await user.click(screen.getByText('Cancel'));
        expect(screen.queryByText('Upload a Note')).not.toBeInTheDocument();
        expect(screen.getByText('+ Upload')).toBeInTheDocument();
    });
});
