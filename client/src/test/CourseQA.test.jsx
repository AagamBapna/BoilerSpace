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
});