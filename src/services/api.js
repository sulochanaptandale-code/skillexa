import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  changePassword: (data) => api.post('/auth/change-password', data),
};

// Users API
export const usersAPI = {
  getUsers: (params) => api.get('/users', { params }),
  getUserById: (id) => api.get(`/users/${id}`),
  updateProfile: (data) => api.put('/users/profile', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  getUserStats: () => api.get('/users/stats/overview'),
  getUserActivity: (id, params) => api.get(`/users/${id}/activity`, { params }),
};

// Courses API
export const coursesAPI = {
  getCourses: (params) => api.get('/courses', { params }),
  getCourseById: (id) => api.get(`/courses/${id}`),
  createCourse: (data) => api.post('/courses', data),
  updateCourse: (id, data) => api.put(`/courses/${id}`, data),
  deleteCourse: (id) => api.delete(`/courses/${id}`),
  publishCourse: (id) => api.patch(`/courses/${id}/publish`),
  enrollInCourse: (id) => api.post(`/courses/${id}/enroll`),
  unenrollFromCourse: (id) => api.delete(`/courses/${id}/enroll`),
  getCourseStudents: (id, params) => api.get(`/courses/${id}/students`, { params }),
  addLesson: (courseId, data) => api.post(`/courses/${courseId}/lessons`, data),
  updateLesson: (courseId, lessonId, data) => api.put(`/courses/${courseId}/lessons/${lessonId}`, data),
  deleteLesson: (courseId, lessonId) => api.delete(`/courses/${courseId}/lessons/${lessonId}`),
  addAssignment: (courseId, data) => api.post(`/courses/${courseId}/assignments`, data),
  updateAssignment: (courseId, assignmentId, data) => api.put(`/courses/${courseId}/assignments/${assignmentId}`, data),
  deleteAssignment: (courseId, assignmentId) => api.delete(`/courses/${courseId}/assignments/${assignmentId}`),
  submitAssignment: (courseId, assignmentId, data) => api.post(`/courses/${courseId}/assignments/${assignmentId}/submit`, data),
  gradeAssignment: (courseId, assignmentId, submissionId, data) => api.put(`/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/grade`, data),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAnalytics: (params) => api.get('/admin/analytics', { params }),
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  getUsers: (params) => api.get('/admin/users', { params }),
  getCourses: (params) => api.get('/admin/courses', { params }),
  getSettings: () => api.get('/admin/settings'),
  updateSettings: (data) => api.put('/admin/settings', data),
  getHealth: () => api.get('/admin/health'),
  exportData: (type, format) => api.get(`/admin/export/${type}`, { 
    params: { format },
    responseType: format === 'csv' ? 'blob' : 'json'
  }),
};

// Instructor API
export const instructorAPI = {
  getDashboard: () => api.get('/instructor/dashboard'),
  getMyCourses: (params) => api.get('/instructor/courses', { params }),
  getMyStudents: (params) => api.get('/instructor/students', { params }),
  getCourseAnalytics: (courseId, params) => api.get(`/instructor/courses/${courseId}/analytics`, { params }),
  getGradebook: (courseId, params) => api.get(`/instructor/courses/${courseId}/gradebook`, { params }),
};

// File upload API
export const uploadAPI = {
  uploadFile: (file, type = 'general') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  uploadMultipleFiles: (files, type = 'general') => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('type', type);
    
    return api.post('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default api;