import { useState, useEffect } from 'react';
import axios from 'axios';

export default function CourseSelector({ userId, onClose }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [userCourses, setUserCourses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fetchedCourses, fetchedUserCourses] = await Promise.all([
          axios.get('/api/courses'),
          axios.get(`/api/users/${userId}/courses`)
        ]);
        setCourses(fetchedCourses.data);
        setUserCourses(fetchedUserCourses.data);
        setSelectedCourses(fetchedUserCourses.data.map(c => c._id));
      } catch (err) {
        console.error('Failed to fetch data:', err);
        if (err.response?.status === 401) {
          setError('You must be logged in to view your courses.');
        } else {
          setError('Failed to load courses. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const departments = [...new Set(courses.map(c => c.department))].sort();

  const filteredCourses = courses.filter(course => {
    const matchesSearch =
      course.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      course.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !departmentFilter || course.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const handleCourseToggle = (courseId) => {
    setSelectedCourses(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId);
      }
      return [...prev, courseId];
    });
    setSuccess(false);
  };

  const handleSave = async () => {
    // in the event that the user attempts to save invalid courses are being 
    if (searchTerm.trim() !== '' && filteredCourses.length === 0) {
      setError(`Invalid course ID provided: ${searchTerm}`);
      setSuccess(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await axios.post(`/api/users/${userId}/courses`, {
        courseIds: selectedCourses
      }, {
        headers: { 'x-user-id': userId }
      });
      setUserCourses(response.data.courses);
      setSuccess(true);
    } catch (err) {
      console.error('Failed to save courses:', err);
      if (err.response?.status === 401) {
        setError('You must be logged in to save courses.');
      } else if (err.response?.data?.invalidIds) {
        setError(`Invalid course IDs: ${err.response.data.invalidIds.join(', ')}`);
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to save courses. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const getSelectedCourseObjects = () => {
    return selectedCourses
      .map(id => courses.find(c => c._id === id))
      .filter(Boolean);
  };

  return (
    <div className="background-blur">
      <div className="course-selector">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
              Select Your Courses
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Choose your classes for the semester
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            Courses saved successfully!
          </div>
        )}
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-purdue-gold)]"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        {/* Selected Courses Tags */}
        {selectedCourses.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-[var(--color-text-secondary)] mb-2">
              Selected ({selectedCourses.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {getSelectedCourseObjects().map(course => (
                <span
                  key={course._id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-purdue-gold)]/20 text-[var(--color-purdue-gold)] rounded-full text-xs font-medium"
                >
                  {course.code}
                  <button
                    onClick={() => handleCourseToggle(course._id)}
                    className="hover:text-white transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
        {/* Course List */}
        <div className="course-list">
          {filteredCourses.length === 0 ? (
            <div className="text-center py-8 text-[var(--color-text-secondary)]">
              No courses found matching your search.
            </div>
          ) : (
            filteredCourses.map(course => (
              <label
                key={course._id}
                className={`course-item ${selectedCourses.includes(course._id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedCourses.includes(course._id)}
                  onChange={() => handleCourseToggle(course._id)}
                  className="sr-only"
                />
                <div className="flex items-start gap-3 w-full">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${selectedCourses.includes(course._id)
                    ? 'bg-[var(--color-purdue-gold)] border-[var(--color-purdue-gold)]'
                    : 'border-[var(--color-border)]'
                    }`}>
                    {selectedCourses.includes(course._id) && (
                      <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {course.code}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-[var(--color-surface-elevated)] rounded text-[var(--color-text-secondary)]">
                        {course.department}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 truncate">
                      {course.title}
                    </p>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
        {/* Footer Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-border)]">
          <span className="text-sm text-[var(--color-text-secondary)]">
            {selectedCourses.length} course{selectedCourses.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Courses'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
