import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NoteUploadForm from '../components/NoteUploadForm';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    defaults: { headers: { common: {} } },
  },
}));

import axios from 'axios';

describe('NoteUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('shows error when submitting with no file', async () => {
    render(<NoteUploadForm courseId="c001" onUploadSuccess={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.submit(screen.getByRole('button', { name: 'Upload Note' }).closest('form'));

    expect(screen.getByText('Please select a file to upload.')).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('rejects invalid file types', async () => {
    const { container } = render(
      <NoteUploadForm courseId="c001" onUploadSuccess={vi.fn()} onCancel={vi.fn()} />
    );

    const input = container.querySelector('input[type="file"]');
    const invalidFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [invalidFile] } });

    expect(
      screen.getByText('Invalid file type. Only PDF, PNG, and JPEG files are allowed.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload Note' })).toBeDisabled();
  });

  test('rejects files larger than 16MB', async () => {
    const { container } = render(
      <NoteUploadForm courseId="c001" onUploadSuccess={vi.fn()} onCancel={vi.fn()} />
    );

    const input = container.querySelector('input[type="file"]');
    const oversizedFile = new File([new Uint8Array(16 * 1024 * 1024 + 1)], 'large.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(input, { target: { files: [oversizedFile] } });

    expect(screen.getByText('File size exceeds the 16MB limit.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload Note' })).toBeDisabled();
  });

  test('uploads a valid file and calls success callback', async () => {
    const onUploadSuccess = vi.fn();
    const user = userEvent.setup();
    axios.post.mockResolvedValueOnce({ data: { _id: 'n001', title: 'Lecture 1' } });

    const { container } = render(
      <NoteUploadForm courseId="c001" onUploadSuccess={onUploadSuccess} onCancel={vi.fn()} />
    );

    const input = container.querySelector('input[type="file"]');
    const validFile = new File(['pdf-content'], 'lecture1.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [validFile] } });

    await user.click(screen.getByRole('button', { name: 'Upload Note' }));

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
    expect(axios.post).toHaveBeenCalledWith(
      '/api/courses/c001/notes',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    expect(onUploadSuccess).toHaveBeenCalledWith({ _id: 'n001', title: 'Lecture 1' });
  });

  test('shows course-not-found error from API', async () => {
    const user = userEvent.setup();
    axios.post.mockRejectedValueOnce({
      response: { data: { error: 'Course not found.' } },
    });

    const { container } = render(
      <NoteUploadForm courseId="bad-course-id" onUploadSuccess={vi.fn()} onCancel={vi.fn()} />
    );

    const input = container.querySelector('input[type="file"]');
    const validFile = new File(['pdf-content'], 'lecture1.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [validFile] } });

    await user.click(screen.getByRole('button', { name: 'Upload Note' }));

    await waitFor(() => {
      expect(screen.getByText('Course not found.')).toBeInTheDocument();
    });
  });
});
