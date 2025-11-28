import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { BookOpen, Plus, CreditCard as Edit, Trash2, Users, Clock } from 'lucide-react';

const CoursesPage = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/courses');
      setCourses(response.data);
    } catch (err) {
      setError('Failed to fetch courses');
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) {
      return;
    }

    try {
      await api.delete(`/courses/${courseId}`);
      setCourses(courses.filter(course => course._id !== courseId));
    } catch (err) {
      setError('Failed to delete course');
      console.error('Error deleting course:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-600">Manage your courses and content</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'instructor') && (
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Course
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course._id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <BookOpen className="w-8 h-8 text-indigo-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
                    <p className="text-sm text-gray-600">{course.category}</p>
                  </div>
                </div>
                {(user?.role === 'admin' || (user?.role === 'instructor' && course.instructor === user._id)) && (
                  <div className="flex space-x-2">
                    <button className="text-gray-400 hover:text-indigo-600">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteCourse(course._id)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <p className="text-gray-700 mb-4 line-clamp-3">{course.description}</p>
              
              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {course.enrolledStudents?.length || 0} students
                </div>
                <div className="flex items-center">
                  <Clock className="w-4 h-4 mr-1" />
                  {course.duration || 'Self-paced'}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  course.status === 'published' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {course.status || 'Draft'}
                </span>
                <button className="text-indigo-600 hover:text-indigo-800 font-medium">
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && !loading && (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No courses found</h3>
          <p className="text-gray-600 mb-4">Get started by creating your first course</p>
          {(user?.role === 'admin' || user?.role === 'instructor') && (
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              Create Course
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CoursesPage;