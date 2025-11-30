import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import LandingPage from './pages/LandingPage';
import DashboardHome from './pages/dashboard/DashboardHome';
import UsersPage from './pages/dashboard/UsersPage';
import CoursesPage from './pages/dashboard/CoursesPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import AdminPage from './pages/dashboard/AdminPage';
import InstructorPage from './pages/dashboard/InstructorPage';
import ProfilePage from './pages/dashboard/ProfilePage';

const AppContent = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />

        {/* Protected dashboard routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<DashboardHome />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="users" element={
            <ProtectedRoute roles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          } />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="analytics" element={
            <ProtectedRoute roles={['admin', 'instructor']}>
              <AnalyticsPage />
            </ProtectedRoute>
          } />
          <Route path="admin" element={
            <ProtectedRoute roles={['admin']}>
              <AdminPage />
            </ProtectedRoute>
          } />
          <Route path="instructor" element={
            <ProtectedRoute roles={['instructor']}>
              <InstructorPage />
            </ProtectedRoute>
          } />
        </Route>

        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;