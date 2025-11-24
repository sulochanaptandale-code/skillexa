import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ 
  children, 
  roles = [], 
  permissions = [], 
  requireAuth = true,
  fallback = null 
}) => {
  const { isAuthenticated, isLoading, user, hasAnyRole, hasPermission } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  // Redirect to login if authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (roles.length > 0 && !hasAnyRole(roles)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500">
            Required role(s): {roles.join(', ')}
          </p>
          <p className="text-sm text-gray-500">
            Your role: {user?.role || 'None'}
          </p>
        </div>
      </div>
    );
  }

  // Check permission-based access
  if (permissions.length > 0) {
    const hasRequiredPermission = permissions.some(permission => hasPermission(permission));
    if (!hasRequiredPermission) {
      return fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600 mb-4">
              You don't have the required permissions to access this page.
            </p>
            <p className="text-sm text-gray-500">
              Required permission(s): {permissions.join(', ')}
            </p>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;