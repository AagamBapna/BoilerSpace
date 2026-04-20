import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExamDatesSection from '../components/ExamDatesSection';
import axios from 'axios';

vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
        defaults: { headers: { common: {} } },
    },
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const examInThreeDays = {
    _id: 'exam-soon',
    title: 'Midterm 1',
    date: new Date(now + 3 * DAY_MS).toISOString(),
    location: 'WALC 1055',
};
const examInThirtyDays = {
    _id: 'exam-later',
    title: 'Final',
    date: new Date(now + 30 * DAY_MS).toISOString(),
    location: '',
};
const examInPast = {
    _id: 'exam-old',
    title: 'Quiz 1',
    date: new Date(now - 5 * DAY_MS).toISOString(),
    location: '',
};

describe('ExamDatesSection — Rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('shows loading state while fetching exams', () => {
        axios.get.mockReturnValue(new Promise(() => {}));
        render(<ExamDatesSection courseId="c001" />);
        expect(screen.getByText('Loading exams...')).toBeInTheDocument();
    });

    test('shows empty state when no upcoming exams exist', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<ExamDatesSection courseId="c001" />);
        await waitFor(() => {
            expect(
                screen.getByText('No upcoming exams listed for this course.')
            ).toBeInTheDocument();
        });
    });

    test('shows fetch error when the API fails', async () => {
        axios.get.mockRejectedValueOnce(new Error('Network Error'));
        render(<ExamDatesSection courseId="c001" />);
        await waitFor(() => {
            expect(screen.getByText('Failed to load exams.')).toBeInTheDocument();
        });
    });

    test('renders upcoming exams from the API', async () => {
        axios.get.mockResolvedValueOnce({
            data: [examInThreeDays, examInThirtyDays],
        });
        render(<ExamDatesSection courseId="c001" />);

        await waitFor(() => {
            expect(screen.getByText('Midterm 1')).toBeInTheDocument();
        });
        expect(screen.getByText('Final')).toBeInTheDocument();
        expect(screen.getByText('WALC 1055')).toBeInTheDocument();
    });

    test('filters out exams whose date has already passed (AC#3)', async () => {
        axios.get.mockResolvedValueOnce({
            data: [examInPast, examInThirtyDays],
        });
        render(<ExamDatesSection courseId="c001" />);

        await waitFor(() => {
            expect(screen.getByText('Final')).toBeInTheDocument();
        });
        expect(screen.queryByText('Quiz 1')).not.toBeInTheDocument();
    });

    test('shows empty state when every exam has already passed', async () => {
        axios.get.mockResolvedValueOnce({ data: [examInPast] });
        render(<ExamDatesSection courseId="c001" />);

        await waitFor(() => {
            expect(
                screen.getByText('No upcoming exams listed for this course.')
            ).toBeInTheDocument();
        });
        expect(screen.queryByText('Quiz 1')).not.toBeInTheDocument();
    });

    test('highlights exams within the next 7 days with priority styling (AC#4)', async () => {
        axios.get.mockResolvedValueOnce({
            data: [examInThreeDays, examInThirtyDays],
        });
        render(<ExamDatesSection courseId="c001" />);

        await waitFor(() => {
            expect(screen.getByText('Midterm 1')).toBeInTheDocument();
        });

        expect(screen.getAllByTestId('exam-priority')).toHaveLength(1);
        expect(screen.getAllByTestId('exam-upcoming')).toHaveLength(1);
        expect(screen.getByText('This week')).toBeInTheDocument();
    });
});

describe('ExamDatesSection — Submission Form', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('shows the form when "+ Add Exam" is clicked', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<ExamDatesSection courseId="c001" />);

        await waitFor(() => {
            expect(screen.getByText('+ Add Exam')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('+ Add Exam'));
        expect(screen.getByLabelText('Exam title')).toBeInTheDocument();
        expect(screen.getByLabelText('Exam date and time')).toBeInTheDocument();
        expect(screen.getByLabelText('Exam location')).toBeInTheDocument();
    });

    test('posts a new exam with the correct payload', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        axios.post.mockResolvedValueOnce({ data: [examInThreeDays] });

        render(<ExamDatesSection courseId="c001" />);
        await waitFor(() => {
            expect(screen.getByText('+ Add Exam')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('+ Add Exam'));

        const titleInput = screen.getByLabelText('Exam title');
        const dateInput = screen.getByLabelText('Exam date and time');
        const locationInput = screen.getByLabelText('Exam location');

        // Build a local datetime-local string for a date 3 days in the future.
        const future = new Date(now + 3 * DAY_MS);
        const pad = (n) => String(n).padStart(2, '0');
        const localDateStr = `${future.getFullYear()}-${pad(
            future.getMonth() + 1
        )}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(
            future.getMinutes()
        )}`;

        await userEvent.type(titleInput, 'Midterm 1');
        // fireEvent-style change — userEvent.type struggles with datetime-local
        fireEvent.change(dateInput, { target: { value: localDateStr } });
        await userEvent.type(locationInput, 'WALC 1055');

        await userEvent.click(screen.getByText('Save Exam'));

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalledTimes(1);
        });
        const [url, body] = axios.post.mock.calls[0];
        expect(url).toBe('/api/courses/c001/exams');
        expect(body.title).toBe('Midterm 1');
        expect(body.location).toBe('WALC 1055');
        expect(body.date).toBe(new Date(localDateStr).toISOString());
    });

    test('rejects a past date with an inline error', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<ExamDatesSection courseId="c001" />);

        await waitFor(() => {
            expect(screen.getByText('+ Add Exam')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('+ Add Exam'));

        const past = new Date(now - 3 * DAY_MS);
        const pad = (n) => String(n).padStart(2, '0');
        const pastStr = `${past.getFullYear()}-${pad(past.getMonth() + 1)}-${pad(
            past.getDate()
        )}T${pad(past.getHours())}:${pad(past.getMinutes())}`;

        await userEvent.type(screen.getByLabelText('Exam title'), 'Midterm 1');
        const dateInput = screen.getByLabelText('Exam date and time');
        fireEvent.change(dateInput, { target: { value: pastStr } });
        await userEvent.click(screen.getByText('Save Exam'));

        await waitFor(() => {
            expect(
                screen.getByText('Exam date must be in the future.')
            ).toBeInTheDocument();
        });
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('requires a title before submitting', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        render(<ExamDatesSection courseId="c001" />);

        await waitFor(() => {
            expect(screen.getByText('+ Add Exam')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('+ Add Exam'));
        await userEvent.click(screen.getByText('Save Exam'));

        expect(screen.getByText('Exam title is required.')).toBeInTheDocument();
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('shows backend error message on POST failure', async () => {
        axios.get.mockResolvedValueOnce({ data: [] });
        axios.post.mockRejectedValueOnce({
            response: { data: { error: 'Course not found' } },
        });

        render(<ExamDatesSection courseId="c001" />);
        await waitFor(() => {
            expect(screen.getByText('+ Add Exam')).toBeInTheDocument();
        });
        await userEvent.click(screen.getByText('+ Add Exam'));

        const future = new Date(now + 3 * DAY_MS);
        const pad = (n) => String(n).padStart(2, '0');
        const futureStr = `${future.getFullYear()}-${pad(
            future.getMonth() + 1
        )}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(
            future.getMinutes()
        )}`;

        await userEvent.type(screen.getByLabelText('Exam title'), 'Midterm 1');
        const dateInput = screen.getByLabelText('Exam date and time');
        fireEvent.change(dateInput, { target: { value: futureStr } });
        await userEvent.click(screen.getByText('Save Exam'));

        await waitFor(() => {
            expect(screen.getByText('Course not found')).toBeInTheDocument();
        });
    });
});
