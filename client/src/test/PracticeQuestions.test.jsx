import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PracticeQuestions from '../components/PracticeQuestions';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

import axios from 'axios';

describe('PracticeQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('generates and displays questions while answers stay hidden initially', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValueOnce({
      data: {
        questions: [
          {
            id: 'q1',
            question: 'What is polymorphism?',
            answer: 'Explain runtime and compile-time variants with one example.',
          },
        ],
      },
    });

    render(
      <PracticeQuestions
        courseId="course-1"
        courseName="CS 30700"
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Generate Practice Questions' }));

    await waitFor(() => {
      expect(screen.getByText('1. What is polymorphism?')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Reveal Answer' })).toBeInTheDocument();
    expect(screen.queryByText('Explanation')).not.toBeInTheDocument();
    expect(screen.queryByText('Explain runtime and compile-time variants with one example.')).not.toBeInTheDocument();
  });

  test('reveals answer only after user clicks reveal button', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValueOnce({
      data: {
        questions: [
          {
            id: 'q1',
            question: 'How does quicksort partition work?',
            answer: 'Describe pivot choice and how elements are split around pivot before recursion.',
          },
        ],
      },
    });

    render(
      <PracticeQuestions
        courseId="course-1"
        courseName="CS 30700"
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Generate Practice Questions' }));

    await waitFor(() => {
      expect(screen.getByText('1. How does quicksort partition work?')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Reveal Answer' }));

    expect(screen.getByText('Explanation')).toBeInTheDocument();
    expect(screen.getByText('Describe pivot choice and how elements are split around pivot before recursion.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide Answer' })).toBeInTheDocument();
  });

  test('shows backend error message when generation fails', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: {
        data: {
          error: 'No PDF notes found for this course',
        },
      },
    });

    render(
      <PracticeQuestions
        courseId="course-1"
        courseName="CS 30700"
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Generate Practice Questions' }));

    await waitFor(() => {
      expect(screen.getByText('No PDF notes found for this course')).toBeInTheDocument();
    });
  });

  test('navigates one question at a time with arrow buttons', async () => {
    const user = userEvent.setup();
    axios.post.mockResolvedValueOnce({
      data: {
        questions: [
          {
            id: 'q1',
            question: 'Question one?',
            answer: 'Answer one.',
          },
          {
            id: 'q2',
            question: 'Question two?',
            answer: 'Answer two.',
          },
        ],
      },
    });

    render(
      <PracticeQuestions
        courseId="course-1"
        courseName="CS 30700"
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Generate Practice Questions' }));

    await waitFor(() => {
      expect(screen.getByText('1. Question one?')).toBeInTheDocument();
    });
    expect(screen.queryByText('2. Question two?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next question' }));
    expect(screen.getByText('2. Question two?')).toBeInTheDocument();
    expect(screen.queryByText('1. Question one?')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous question' }));
    expect(screen.getByText('1. Question one?')).toBeInTheDocument();
  });
});
