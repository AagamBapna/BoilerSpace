import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useInRouterContext, Link } from 'react-router-dom';
import axios from 'axios';
import CampusMap from './components/CampusMap';
import BuildingSidebar from './components/BuildingSidebar';
import CourseNotes from './components/CourseNotes';
import ProfileViewer from './components/ProfileViewer';
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import ResetPasswordForm from './components/ResetPasswordForm';
import EmailVerification from './components/EmailVerification';
import DMInbox from './components/DMInbox';
import ClassmateDiscovery from './components/ClassmateDiscovery';
import ClassmateSearch from './components/ClassmateSearch';
import FriendRequests from './components/FriendRequests';
import FriendsList from './components/FriendsList';
import ClassmateProfile from './components/ClassmateProfile';
import ClubList from './pages/ClubList';
import ClubProfile from './pages/ClubProfile';
import ClubOrganizerDashboard from './pages/ClubOrganizerDashboard';
import ActivityPage from './pages/ActivityPage';
import EventPage from './pages/EventPage';
import StudyPlanGenerator from './components/StudyPlanGenerator';
import BookmarkedResources from './components/BookmarkedResources';
import GlobalEventBanner from './components/GlobalEventBanner';
import AdminBroadcastDashboard from './pages/AdminBroadcastDashboard';
import { getToken, setToken, clearToken } from './lib/auth';
import NotificationBell from './components/NotificationBell';
import StudyTimeWidget from './components/StudyTimeWidget';
import StudyTimePill from './components/StudyTimePill';
import { useSocket } from './lib/useSocket';
import './index.css';

export default function App() {
  const inRouterContext = useInRouterContext();
  const routerLocation = { pathname: window.location.pathname };

  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [prefilledResetToken, setPrefilledResetToken] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [pendingVerificationPassword, setPendingVerificationPassword] = useState('');
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notesView, setNotesView] = useState(null);
  const [userCourses, setUserCourses] = useState([]);
  const [bookmarkedRoomIds, setBookmarkedRoomIds] = useState(new Set());
  const [bookmarks, setBookmarks] = useState([]);
  const [recentBuildings, setRecentBuildings] = useState([])
  const [showDM, setShowDM] = useState(false);
  const [showClassmates, setShowClassmates] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [showStudyPlan, setShowStudyPlan] = useState(false);
  const [viewingClassmateId, setViewingClassmateId] = useState(null);
  const [returnToScreen, setReturnToScreen] = useState(null);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);
  const [isQuietZonesOnly, setIsQuietZonesOnly] = useState(false);
  const [showStudyTime, setShowStudyTime] = useState(false);
  const [studyTimeRefreshKey, setStudyTimeRefreshKey] = useState(0);
  const [navExpanded, setNavExpanded] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const socketRef = useSocket(user);

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      return;
    }
    const s = socketRef?.current;
    if (!s) return;

    const handleOnlineUsers = (userIds) => {
      setOnlineUserIds(new Set(userIds));
    };
    const handleUserOnline = (data) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.add(data.userId);
        return next;
      });
    };
    const handleUserOffline = (data) => {
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
    };

    s.on('onlineUsers', handleOnlineUsers);
    s.on('userOnline', handleUserOnline);
    s.on('userOffline', handleUserOffline);

    return () => {
      s.off('onlineUsers', handleOnlineUsers);
      s.off('userOnline', handleUserOnline);
      s.off('userOffline', handleUserOffline);
    };
  }, [user, socketRef]);

  const refreshRecentBuildings = useCallback(async () => {
    try {
      const res = await axios.get('/api/users/recentBuildings');
      setRecentBuildings(res.data);
    } catch (err) {
      console.error('Failed to fetch recent buildings:', err);
    }
  }, []);


  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    const pathname = window.location.pathname;

    if (tokenFromUrl) {
      setPrefilledResetToken(tokenFromUrl);
      window.history.replaceState({}, '', '/reset-password');
      setAuthMode('reset');
      return;
    }

    if (pathname === '/reset-password') {
      setAuthMode('reset');
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (token) {
      setToken(token);
      axios.get('/api/auth/me')
        .then((res) => {
          setUser(res.data);
          // Fetch bookmarks after auth, but do not invalidate auth if this fails.
          axios.get('/api/users/bookmarks')
            .then((bookmarksRes) => {
              const ids = new Set(bookmarksRes.data.map((r) => r._id));
              setBookmarkedRoomIds(ids);
              setBookmarks(bookmarksRes.data);
            })
            .catch((err) => {
              console.error('Failed to fetch bookmarks:', err);
              setBookmarkedRoomIds(new Set());
              setBookmarks([]);
            });
          refreshRecentBuildings();
          axios.get('/api/users/recentBuildings')
            .then((recentRes) => {
              setRecentBuildings(recentRes.data);
            })
            .catch((err) => {
              console.error('Failed to fetch recent buildings:', err);
              setRecentBuildings([]);
            });
          axios.get('/api/friendships/pending')
            .then((pendingRes) => {
              setPendingRequestCount(pendingRes.data.incoming.length);
            })
            .catch(() => setPendingRequestCount(0));
        })
        .catch(() => {
          clearToken();
          setUser(null);
        })
        .finally(() => setAuthChecking(false));
    } else {
      setAuthChecking(false);
    }
  }, [refreshRecentBuildings]);

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
    setBookmarkedRoomIds(new Set());
    setBookmarks([]);
    setPendingRequestCount(0);
  }, []);

  const handleToggleBookmark = useCallback(async (roomId, isBookmarked) => {
    try {
      let res;
      if (isBookmarked) {
        res = await axios.delete(`/api/users/bookmarks/${roomId}`);
        setBookmarkedRoomIds((prev) => {
          const next = new Set(prev);
          next.delete(roomId);
          return next;
        });
      } else {
        res = await axios.post(`/api/users/bookmarks/${roomId}`);
        setBookmarkedRoomIds((prev) => new Set(prev).add(roomId));
      }
      // Update full bookmarks array from server response
      if (res.data.bookmarks) {
        setBookmarks(res.data.bookmarks);
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  }, []);

  const handleLoginSuccess = useCallback(async (userData) => {
    setUser(userData);
    try {
      const res = await axios.get('/api/users/bookmarks');
      setBookmarkedRoomIds(new Set(res.data.map((r) => r._id)));
      setBookmarks(res.data);
    } catch (err) {
      console.error('Failed to fetch bookmarks after login:', err);
    }
    axios.get('/api/friendships/pending')
      .then((pendingRes) => setPendingRequestCount(pendingRes.data.incoming.length))
      .catch(() => setPendingRequestCount(0));
  }, []);

  const navigateAuthMode = useCallback((mode, options = {}) => {
    const nextToken = options.token ?? '';

    if (mode === 'reset') {
      const query = nextToken ? `?token=${encodeURIComponent(nextToken)}` : '';
      window.history.replaceState({}, '', `/reset-password${query}`);
    } else {
      window.history.replaceState({}, '', '/');
    }

    setAuthMode(mode);
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
            <span className="text-2xl">!</span>
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
          onSuccess={handleLoginSuccess}
          onSwitchToRegister={() => navigateAuthMode('register')}
          onForgotPassword={() => navigateAuthMode('forgot')}
        />
      );
    }
    if (authMode === 'forgot') {
      return (
        <ForgotPasswordForm
          onBackToLogin={() => navigateAuthMode('login')}
          onSwitchToReset={() => navigateAuthMode('reset')}
        />
      );
    }
    if (authMode === 'reset') {
      return (
        <ResetPasswordForm
          initialToken={prefilledResetToken}
          onBackToLogin={() => navigateAuthMode('login')}
          onSwitchToForgot={() => navigateAuthMode('forgot')}
        />
      );
    }
    if (authMode === 'verify-email' && pendingVerificationEmail) {
      return (
        <EmailVerification
          email={pendingVerificationEmail}
          onVerified={async () => {
            try {
              const loginRes = await axios.post('/api/auth/login', {
                email: pendingVerificationEmail,
                password: pendingVerificationPassword,
              });
              setToken(loginRes.data.token);
              setUser(loginRes.data.user);
              setPendingVerificationEmail('');
              setPendingVerificationPassword('');
            } catch {
              setAuthMode('login');
            }
          }}
          onBackToLogin={() => {
            setPendingVerificationEmail('');
            setPendingVerificationPassword('');
            navigateAuthMode('login');
          }}
        />
      );
    }
    return (
      <RegisterForm
        onSuccess={handleLoginSuccess}
        onSwitchToLogin={() => navigateAuthMode('login')}
        onNeedVerification={(email, password) => {
          setPendingVerificationEmail(email);
          setPendingVerificationPassword(password);
          setAuthMode('verify-email');
        }}
      />
    );
  }

  const mapExperience = (
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
          bookmarkedRoomIds={bookmarkedRoomIds}
          onToggleBookmark={handleToggleBookmark}
          bookmarks={bookmarks}
          recentBuildings={recentBuildings}
          onRefreshRecentBuildings={refreshRecentBuildings}
          isQuietZonesOnly={isQuietZonesOnly}
        />

      </div>

      <div className="flex-1 relative overflow-hidden h-full flex flex-col w-full">
        <CampusMap
          buildings={buildings}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={handleSelectBuilding}
          isQuietZonesOnly={isQuietZonesOnly}
          setIsQuietZonesOnly={setIsQuietZonesOnly}
        />
      </div>

      {/* ── Top Nav Bar ── */}
      <div className="fixed top-4 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">

        {/* Main visible nav row */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {user?.isAdmin && (
            <button onClick={() => setShowAdminDashboard(true)} className="h-10 px-5 bg-[var(--color-surface-light)] border border-blue-500/30 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-bold hover:bg-blue-500/10 transition-colors text-blue-400 font-medium">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}

          {/* Quiet Zones Toggle */}
          <div className="bg-[var(--color-surface-light)] h-10 px-5 border border-[var(--color-purdue-gold)]/20 rounded-xl shadow-lg flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--color-text-primary)] hidden sm:inline">Quiet Zones</span>
            <button
              onClick={() => setIsQuietZonesOnly(!isQuietZonesOnly)}
              className={`w-10 h-6 flex items-center rounded-full transition-colors ${isQuietZonesOnly ? 'bg-[var(--color-purdue-gold)]' : 'bg-[#404040]'
                } focus:outline-none`}
              aria-pressed={isQuietZonesOnly}
            >
              <div className={`w-4 h-4 bg-white rounded-full mx-1 shadow-sm transition-transform ${isQuietZonesOnly ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          <StudyTimePill
            userId={user.id}
            refreshKey={studyTimeRefreshKey}
            onClick={() => setShowStudyTime(true)}
          />

          <NotificationBell onSelectBuilding={handleSelectBuilding} buildings={buildings} />

          <button onClick={() => setNavExpanded(!navExpanded)} className="h-10 px-5 bg-[var(--color-surface-light)] border border-[var(--color-purdue-gold)]/20 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-primary)]">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {navExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
            <span className="hidden sm:inline">Menu</span>
          </button>

          <button onClick={() => setShowProfile(true)} className="h-10 px-5 bg-[var(--color-surface-light)] border border-[var(--color-purdue-gold)]/20 rounded-xl shadow-lg flex items-center gap-2.5 text-sm font-medium hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-primary)]">
            {user.profilePictureUrl ? (
              <img src={user.profilePictureUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] flex items-center justify-center text-black font-bold text-[10px] flex-shrink-0">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <span className="hidden sm:inline">Profile</span>
          </button>
        </div>

        {/* Collapsible Dropdown Menu */}
        {navExpanded && (
          <div className="bg-[var(--color-surface-light)] border border-white/10 rounded-xl shadow-2xl p-2 flex flex-col gap-1 w-56 pointer-events-auto max-h-[70vh] overflow-y-auto animate-dropdownIn">

            {inRouterContext ? (
              <>
                <Link to="/clubs" onClick={() => setNavExpanded(false)} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">Clubs</Link>
                <Link to="/activity" onClick={() => setNavExpanded(false)} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">Activity</Link>
                <Link to="/bookmarks/ai" onClick={() => setNavExpanded(false)} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">Bookmarks</Link>
              </>
            ) : (
              <>
                <a href="/clubs" className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">Clubs</a>
                <a href="/activity" className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">Activity</a>
                <a href="/bookmarks/ai" className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">Bookmarks</a>
              </>
            )}

            <div className="h-px w-full bg-white/10 my-1" />

            <button onClick={() => { axios.get(`/api/users/${user.id}/courses`).then(res => { setUserCourses(res.data); setNotesView({ step: 'pick' }); setNavExpanded(false); }).catch(() => setUserCourses([])); }} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">
              Course Notes
            </button>
            <button onClick={() => { setShowStudyPlan(true); setNavExpanded(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">
              Study Plan
            </button>

            <div className="h-px w-full bg-white/10 my-1" />

            <button onClick={() => { setShowDM(true); setNavExpanded(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">
              Messages
            </button>
            <button onClick={() => { setShowSearch(true); setNavExpanded(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">
              Find Match
            </button>
            <button onClick={() => { setShowClassmates(true); setNavExpanded(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">
              Classmates
            </button>
            <button onClick={() => { setShowFriendsList(true); setNavExpanded(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3">
              Friends
            </button>
            <button onClick={() => { setShowFriendRequests(true); setNavExpanded(false); }} className="w-full text-left px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors flex items-center gap-3 relative">
              Requests
              {pendingRequestCount > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center pointer-events-none">
                  {pendingRequestCount}
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Course Picker for Notes */}
      {notesView?.step === 'pick' && (
        <div className="background-blur">
          <div className="course-selector" style={{ maxWidth: '480px' }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Course Notes</h2>
                <p className="text-sm text-[var(--color-text-secondary)]">Select a course to view notes</p>
              </div>
              <button
                onClick={() => setNotesView(null)}
                className="p-2 hover:bg-[var(--color-surface-elevated)] rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {userCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <p className="text-sm text-[var(--color-text-secondary)]">No courses enrolled yet.</p>
                <button
                  onClick={() => { setNotesView(null); setShowProfile(true); }}
                  className="text-xs text-[var(--color-purdue-gold)] hover:underline"
                >
                  Add courses in your profile
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                {userCourses.map(course => (
                  <button
                    key={course._id}
                    onClick={() => setNotesView({ step: 'notes', courseId: course._id, courseName: `${course.courseCode} — ${course.title}` })}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-purdue-gold)]/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[var(--color-purdue-gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[var(--color-text-primary)]">{course.courseCode}</p>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">{course.title}</p>
                    </div>
                    <svg className="w-4 h-4 text-[var(--color-text-secondary)] ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Course Notes Modal */}
      {notesView?.step === 'notes' && (
        <CourseNotes
          courseId={notesView.courseId}
          courseName={notesView.courseName}
          userId={user.id}
          onClose={() => setNotesView(null)}
        />
      )}

      {/* Profile Modal */}
      {showProfile && (
        <ProfileViewer
          userId={user.id}
          user={user}
          onClose={() => setShowProfile(false)}
          onUserUpdate={(updatedUser) => setUser(prev => ({ ...prev, ...updatedUser }))}
          onLogout={handleLogout}
        />
      )}

      {showStudyTime && (
        <StudyTimeWidget
          userId={user.id}
          user={user}
          onClose={() => {
            setShowStudyTime(false);
            // Bump the key so the top-bar pill refetches its weekly total
            // (e.g. if the user logged a session inside the modal).
            setStudyTimeRefreshKey((k) => k + 1);
          }}
          onUserUpdate={(updatedUser) => setUser((prev) => ({ ...prev, ...updatedUser }))}
          onSessionLogged={() => setStudyTimeRefreshKey((k) => k + 1)}
        />
      )}

      {showDM && (
        <DMInbox
          currentUserId={user.id}
          socket={socketRef}
          onClose={() => setShowDM(false)}
          onlineUserIds={onlineUserIds}
        />
      )}

      {showClassmates && (
        <ClassmateDiscovery
          onClose={() => setShowClassmates(false)}
          onViewProfile={(id) => { setShowClassmates(false); setReturnToScreen('classmates'); setViewingClassmateId(id); }}
        />
      )}

      {showSearch && (
        <ClassmateSearch
          onClose={() => setShowSearch(false)}
          onViewProfile={(id) => { setShowSearch(false); setReturnToScreen('search'); setViewingClassmateId(id); }}
        />
      )}

      {showFriendRequests && (
        <FriendRequests
          onClose={() => { setShowFriendRequests(false); axios.get('/api/friendships/pending').then(r => setPendingRequestCount(r.data.incoming.length)).catch(() => { }); }}
          onViewProfile={(id) => { setShowFriendRequests(false); setReturnToScreen('requests'); setViewingClassmateId(id); }}
        />
      )}

      {showFriendsList && (
        <FriendsList
          onClose={() => setShowFriendsList(false)}
          onViewProfile={(id) => { setShowFriendsList(false); setReturnToScreen('friends'); setViewingClassmateId(id); }}
        />
      )}

      {viewingClassmateId && (
        <ClassmateProfile
          userId={viewingClassmateId}
          onClose={() => {
            setViewingClassmateId(null);
            if (returnToScreen === 'classmates') setShowClassmates(true);
            else if (returnToScreen === 'search') setShowSearch(true);
            else if (returnToScreen === 'requests') setShowFriendRequests(true);
            else if (returnToScreen === 'friends') setShowFriendsList(true);
            setReturnToScreen(null);
          }}
        />
      )}
      {showStudyPlan && (
        <StudyPlanGenerator
          userId={user.id}
          onClose={() => setShowStudyPlan(false)}
        />
      )}

      {showAdminDashboard && (
        <AdminBroadcastDashboard
          user={user}
          onClose={() => setShowAdminDashboard(false)}
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

  const isMapPage = !['/clubs', '/activity', '/events', '/announcements'].some(path => routerLocation.pathname.startsWith(path));

  if (!inRouterContext) return (
    <div className="h-screen w-screen flex flex-col">
      <GlobalEventBanner isMapPage={true} />
      <div className="flex-1 relative overflow-hidden">
        {mapExperience}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-screen overflow-y-auto overflow-x-hidden">
      <div className="flex-1 relative overflow-hidden">
        <GlobalEventBanner isMapPage={isMapPage} />
        <Routes>
          <Route path="/clubs" element={<ClubList user={user} />} />
          <Route path="/clubs/:id" element={<ClubProfile user={user} />} />
          <Route path="/clubs/:id/dashboard" element={<ClubOrganizerDashboard user={user} />} />
          <Route path="/activity" element={<ActivityPage initialTab="events" />} />
          <Route path="/events" element={<ActivityPage initialTab="events" />} />
          <Route path="/events/:id" element={<EventPage user={user} />} />
          <Route path="/announcements" element={<ActivityPage initialTab="announcements" />} />
          <Route path="/bookmarks/ai" element={<BookmarkedResources />} />
          <Route path="*" element={mapExperience} />
        </Routes>
      </div>
    </div>
  );
}

