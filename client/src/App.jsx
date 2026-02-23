import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CampusMap from './components/CampusMap';
import BuildingSidebar from './components/BuildingSidebar';
import CourseSelector from './components/CourseSelector';
import './index.css';

const MOCK_USER_ID = 'u001';

export default function App() {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCourseSelector, setShowCourseSelector] = useState(false);

  // Fetch buildings on mount
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const res = await axios.get('/api/buildings');
        setBuildings(res.data);
      } catch (err) {
        console.error('Failed to fetch buildings:', err);
        setError('Failed to load buildings. Make sure the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchBuildings();
  }, []);

  // Listen for "View Rooms" click from map popup
  useEffect(() => {
    const handler = (e) => {
      const building = buildings.find((b) => b._id === e.detail);
      if (building) {
        setSelectedBuilding(building);
        setSidebarOpen(true); // auto-open sidebar on mobile when viewing rooms
      }
    };
    document.addEventListener('viewRooms', handler);
    return () => document.removeEventListener('viewRooms', handler);
  }, [buildings]);

  const handleSelectBuilding = useCallback((building) => {
    setSelectedBuilding(building);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSelectedBuilding(null);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[var(--color-surface)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
          <p className="text-[var(--color-text-secondary)] text-sm">Loading BoilerSpace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[var(--color-surface)]">
        <div className="text-center max-w-md px-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-lg font-bold mb-2">Connection Error</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-semibold rounded-lg text-sm hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <BuildingSidebar
          buildings={buildings}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={handleSelectBuilding}
          onClose={handleCloseSidebar}
        />
      </div>

      {/* Map */}
      <CampusMap
        buildings={buildings}
        selectedBuilding={selectedBuilding}
        onSelectBuilding={handleSelectBuilding}
      />

      {/* Profile Button */}
      <button
        onClick={() => setShowCourseSelector(true)}
        className="profile-button"
      >
        <div className="profile-avatar">T</div>
        <span>My Courses</span>
      </button>

      {/* Course Selector*/}
      {showCourseSelector && (
        <CourseSelector
          userId={MOCK_USER_ID}
          onClose={() => setShowCourseSelector(false)}
        />
      )}

      {/* Mobile toggle button */}
      <button
        onClick={toggleSidebar}
        className="sidebar-toggle"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
    </div>
  );
}
