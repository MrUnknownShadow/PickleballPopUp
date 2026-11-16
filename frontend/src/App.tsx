import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Leaderboard from './pages/Leaderboard';
import Results from './pages/Results';
import SessionReport from './pages/SessionReport';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Admin from './pages/Admin';
import Schedule from './pages/Schedule';
import { Privacy, Terms } from './pages/Legal';
import { AuthProvider, useAuth } from './context/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { username } = useAuth();
  const here = useLocation();
  // Not signed in: go to the login page and come back here afterwards (links in texts point at /schedule).
  if (!username) return <Navigate to={`/login?next=${encodeURIComponent(here.pathname + here.search)}`} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/schedule" element={<Schedule />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/events" replace />} />
        <Route path="events" element={<Events />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="history" element={<Results />} />
        <Route path="history/:id" element={<SessionReport />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
