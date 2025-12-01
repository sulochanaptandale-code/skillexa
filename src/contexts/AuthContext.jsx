import { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext();

// Mock users for demo
const MOCK_USERS = {
  'admin@example.com': {
    id: 'admin-001',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    password: 'password123',
    role: 'admin'
  },
  'instructor@example.com': {
    id: 'instructor-001',
    email: 'instructor@example.com',
    firstName: 'Instructor',
    lastName: 'User',
    password: 'password123',
    role: 'instructor'
  },
  'student@example.com': {
    id: 'student-001',
    email: 'student@example.com',
    firstName: 'Student',
    lastName: 'User',
    password: 'password123',
    role: 'student'
  }
};

const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
  error: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null
      };
    
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null
      };
    
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload
      };
    
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { user, token }
          });
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          dispatch({
            type: 'AUTH_FAILURE',
            payload: 'Session expired'
          });
        }
      } else {
        dispatch({
          type: 'AUTH_FAILURE',
          payload: null
        });
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const { email, password } = credentials;

      // Mock authentication
      const mockUser = MOCK_USERS[email];
      if (!mockUser || mockUser.password !== password) {
        const message = 'Invalid email or password';
        dispatch({
          type: 'AUTH_FAILURE',
          payload: message
        });
        return { success: false, error: message };
      }

      // Generate a simple token
      const token = btoa(`${email}:${Date.now()}`);

      // Store user and token
      const userData = {
        id: mockUser.id,
        email: mockUser.email,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        role: mockUser.role
      };

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user: userData, token }
      });

      return { success: true };
    } catch (error) {
      const message = 'Login failed';
      dispatch({
        type: 'AUTH_FAILURE',
        payload: message
      });
      return { success: false, error: message };
    }
  };

  const register = async (userData) => {
    dispatch({ type: 'AUTH_START' });
    try {
      const { email, password, firstName, lastName } = userData;

      // Check if user already exists
      if (MOCK_USERS[email]) {
        const message = 'User already exists with this email';
        dispatch({
          type: 'AUTH_FAILURE',
          payload: message
        });
        return { success: false, error: message };
      }

      // For demo, just allow registration (in real app, validate on backend)
      const newUser = {
        id: `user-${Date.now()}`,
        email,
        firstName,
        lastName,
        role: 'student'
      };

      const token = btoa(`${email}:${Date.now()}`);

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(newUser));

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user: newUser, token }
      });

      return { success: true };
    } catch (error) {
      const message = 'Registration failed';
      dispatch({
        type: 'AUTH_FAILURE',
        payload: message
      });
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = (userData) => {
    dispatch({
      type: 'UPDATE_USER',
      payload: userData
    });
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const hasRole = (role) => {
    return state.user?.role === role;
  };

  const hasAnyRole = (roles) => {
    return roles.includes(state.user?.role);
  };

  const hasPermission = (permission) => {
    if (!state.user) return false;
    
    const rolePermissions = {
      admin: ['*'], // Admin has all permissions
      instructor: [
        'course:create', 'course:read', 'course:update', 'course:delete',
        'student:read', 'grade:create', 'grade:read', 'grade:update',
        'assignment:create', 'assignment:read', 'assignment:update', 'assignment:delete',
        'content:create', 'content:read', 'content:update', 'content:delete'
      ],
      student: [
        'course:read', 'assignment:read', 'grade:read',
        'profile:read', 'profile:update'
      ]
    };
    
    const permissions = rolePermissions[state.user.role] || [];
    return permissions.includes('*') || permissions.includes(permission);
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    clearError,
    hasRole,
    hasAnyRole,
    hasPermission
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};