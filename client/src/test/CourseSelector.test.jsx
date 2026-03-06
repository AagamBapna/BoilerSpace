import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CourseSelector from '../components/CourseSelector';

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import axios from 'axios';

const sampleCourses = [
  {
    _id: 'c1',
    courseCode: 'CS 30700',
    title: 'Software Engineering I',
    semester: 'Spring 2026',
    department: 'CS',
  },
  {
    _id: 'c2',
    courseCode: 'MA 26100',
    title: 'Multivariate Calculus',
    semester: 'Spring 2026',
    department: 'MA',
  },
];

describe('CourseSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    axios.get.mockImplementation((url) => {
      if (url === '/api/courses') return Promise.resolve({ data: sampleCourses });
      if (url === '/api/users/u1/courses') return Promise.resolve({ data: [] });
      return Promise.reject(new Error(`Unexpected GET request: ${url}`));
    });
  });

  test('renders course code, title, and semester for available courses', async () => {
    render(<CourseSelector userId="u1" embedded={true} />);

    await waitFor(() => {
      expect(screen.getByText('CS 30700')).toBeInTheDocument();
    });

    expect(screen.getByText('Software Engineering I')).toBeInTheDocument();
    expect(screen.getAllByText('Spring 2026').length).toBeGreaterThan(0);
    expect(screen.getByText('MA 26100')).toBeInTheDocument();
    expect(screen.getByText('Multivariate Calculus')).toBeInTheDocument();
  });

  test('keeps title and semester visible when searching for a specific course', async () => {
    const user = userEvent.setup();
    render(<CourseSelector userId="u1" embedded={true} />);

    const searchInput = await screen.findByPlaceholderText('Search courses...');
    await user.type(searchInput, 'CS 30700');

    expect(screen.getByText('CS 30700')).toBeInTheDocument();
    expect(screen.getByText('Software Engineering I')).toBeInTheDocument();
    expect(screen.getByText('Spring 2026')).toBeInTheDocument();
  });
});
