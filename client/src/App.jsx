import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import CampusMap from './components/CampusMap';
import BuildingSidebar from './components/BuildingSidebar';
import CourseSelector from './components/CourseSelector';
import ProfileViewer from './components/ProfileViewer';
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import ResetPasswordForm from './components/ResetPasswordForm';
import { getToken, setToken, clearToken } from './lib/auth';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCourseSelector, setShowCourseSelector] = useState(false);
  const [showProfile, setShowProfile] = useState(false);


  useEffect(() => {
    const token = getToken();
    if (token) {
      setToken(token);
      axios.get('/api/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => clearToken())
        .finally(() => setAuthChecking(false));
    } else {
      setAuthChecking(false);
    }
  }, []);

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

  useEffect(() => {
    const handler = (e) => {
      const building = buildings.find((b) => String(b._id) === e.detail);
      if (building) {
        setSelectedBuilding(building);
        setSidebarOpen(true);
      }
    };
    document.addEventListener('viewRooms', handler);
    return () => document.removeEventListener('viewRooms', handler);
  }, [buildings]);

  const handleSelectBuilding = useCallback((building) => {
    setSelectedBuilding(building);
    setSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setSelectedBuilding(null);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  if (authChecking || loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[var(--color-surface)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-[var(--color-purdue-gold)]/30 border-t-[var(--color-purdue-gold)] rounded-full animate-spin" />
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

  if (!user) {
    if (authMode === 'login') {
      return (
        <LoginForm
          onSuccess={setUser}
          onSwitchToRegister={() => setAuthMode('register')}
          onForgotPassword={() => setAuthMode('forgot')}
        />
      );
    }
    if (authMode === 'forgot') {
      return (
        <ForgotPasswordForm
          onBackToLogin={() => setAuthMode('login')}
          onSwitchToReset={() => setAuthMode('reset')}
        />
      );
    }
    if (authMode === 'reset') {
      return (
        <ResetPasswordForm
          onBackToLogin={() => setAuthMode('login')}
          onSwitchToForgot={() => setAuthMode('forgot')}
        />
      );
    }
    return (
      <RegisterForm
        onSuccess={setUser}
        onSwitchToLogin={() => setAuthMode('login')}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className={`sidebar-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <BuildingSidebar
          buildings={buildings}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={handleSelectBuilding}
          onClose={handleCloseSidebar}
          user={user}
          onLogout={handleLogout}
        />
      </div>

      <CampusMap
        buildings={buildings}
        selectedBuilding={selectedBuilding}
        onSelectBuilding={handleSelectBuilding}
      />

      {/* Profile Button — Course Selector */}
      <button onClick={() => setShowProfile(true)} className="profile-button">
        <div className="profile-avatar">{user.displayName?.[0] || 'U'}</div>
          <span>My Profile</span>
      </button>


      {/* Course Selector Modal */}
      {showProfile && (
        <ProfileViewer
          userId={user.id}
          user={user}
          onClose={() => setShowProfile(false)}
          onUserUpdate={(updatedUser) => setUser(prev => ({ ...prev, ...updatedUser }))}
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
