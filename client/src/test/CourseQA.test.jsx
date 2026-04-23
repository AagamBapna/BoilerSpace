import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CourseQA from '../components/CourseQA';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

import axios from 'axios';

describe('CourseQA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('asks a question and displays the AI answer', async () => {
    const user = userEvent.setup({ delay: null });
    axios.post.mockResolvedValueOnce({
      data: {
        answer: 'The notes explain that a recurrence relation defines a sequence recursively.',
      },
    });

    render(<CourseQA courseId="course-1" courseName="CS 30700" onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/what is the main idea/i), 'What is a recurrence relation?');
    await user.click(screen.getByRole('button', { name: 'Ask AI' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith('/api/courses/course-1/qa', {
        question: 'What is a recurrence relation?',
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText('The notes explain that a recurrence relation defines a sequence recursively.')
      ).toBeInTheDocument();
    });
  });

  test('shows no-notes backend error', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: { data: { error: 'No PDF notes found for this course' } },
    });

    render(<CourseQA courseId="course-1" courseName="CS 30700" onClose={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/what is the main idea/i), 'What is a recurrence relation?');
    await user.click(screen.getByRole('button', { name: 'Ask AI' }));

    await waitFor(() => {
      expect(screen.getByText('No PDF notes found for this course')).toBeInTheDocument();
    });
  });

  describe('bookmark toggle', () => {
    async function askAndGetAnswer(user) {
      axios.post.mockResolvedValueOnce({
        data: { answer: 'Divide and conquer breaks problems into smaller subproblems.' },
      });
      render(<CourseQA courseId="course-42" courseName="CS 30700" onClose={vi.fn()} />);
      await user.type(
        screen.getByPlaceholderText(/what is the main idea/i),
        'Why divide and conquer?'
      );
      await user.click(screen.getByRole('button', { name: 'Ask AI' }));
      await waitFor(() => {
        expect(
          screen.getByText('Divide and conquer breaks problems into smaller subproblems.')
        ).toBeInTheDocument();
      });
    }

    test('bookmark icon is hidden until an answer arrives', () => {
      render(<CourseQA courseId="course-42" courseName="CS 30700" onClose={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /bookmark/i })).not.toBeInTheDocument();
    });

    test('saves the Q+A pair to the bookmarks endpoint with the right payload', async () => {
      const user = userEvent.setup({ delay: null });
      await askAndGetAnswer(user);

      axios.post.mockResolvedValueOnce({
        data: { _id: 'new-bookmark', promptString: 'Why divide and conquer?' },
      });

      await user.click(screen.getByRole('button', { name: /bookmark this response/i }));

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalledWith('/api/users/bookmarks/ai', {
          promptString: 'Why divide and conquer?',
          aiResponseText: 'Divide and conquer breaks problems into smaller subproblems.',
          courseId: 'course-42',
        });
      });

      expect(await screen.findByText('Saved to your bookmarks')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /bookmarked/i })).toBeDisabled();
    });

    test('uses the asked question, not a newly edited textarea, as the prompt', async () => {
      const user = userEvent.setup({ delay: null });
      await askAndGetAnswer(user);

      await user.clear(screen.getByPlaceholderText(/what is the main idea/i));
      await user.type(
        screen.getByPlaceholderText(/what is the main idea/i),
        'A completely different question'
      );

      axios.post.mockResolvedValueOnce({ data: { _id: 'x' } });
      await user.click(screen.getByRole('button', { name: /bookmark this response/i }));

      await waitFor(() => {
        const saveCall = axios.post.mock.calls.find(
          (c) => c[0] === '/api/users/bookmarks/ai'
        );
        expect(saveCall[1].promptString).toBe('Why divide and conquer?');
      });
    });

    test('shows an inline error if the bookmark request fails', async () => {
      const user = userEvent.setup({ delay: null });
      await askAndGetAnswer(user);

      axios.post.mockRejectedValueOnce({
        response: { data: { error: 'Failed to save AI bookmark' } },
      });

      await user.click(screen.getByRole('button', { name: /bookmark this response/i }));

      expect(await screen.findByText('Failed to save AI bookmark')).toBeInTheDocument();
      expect(screen.queryByText('Saved to your bookmarks')).not.toBeInTheDocument();
    });
  });
});