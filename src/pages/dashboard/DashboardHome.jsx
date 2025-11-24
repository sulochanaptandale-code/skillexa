import { useState, useEffect } from 'react';
import { 
  Users, 
  BookOpen, 
  TrendingUp, 
  Award,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Activity
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI, usersAPI, coursesAPI } from '../../services/api';

const DashboardHome = () => {
  const { user, hasRole } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        if (hasRole('admin')) {
          const response = await adminAPI.getDashboard();
          setStats(response.data.stats);
        } else {
          // For non-admin users, fetch basic stats
          const [userStats] = await Promise.all([
            usersAPI.getUserStats().catch(() => ({ data: { stats: {} } }))
          ]);
          setStats(userStats.data.stats);
        }
        
        // Fetch user activity
        if (user) {
          const activityResponse = await usersAPI.getUserActivity(user.id, { limit: 10 });
          setRecentActivity(activityResponse.data.activity || []);
        }
      } catch (err) {
        console.error('Dashboard data fetch error:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, hasRole]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatsForRole = () => {
    if (hasRole('admin') && stats) {
      return [
        {
          name: 'Total Users',
          value: stats.users?.total || 0,
          change: `+${stats.users?.newThisMonth || 0} this month`,
          icon: Users,
          color: 'bg-blue-500'
        },
        {
          name: 'Total Courses',
          value: stats.courses?.total || 0,
          change: `+${stats.courses?.newThisMonth || 0} this month`,
          icon: BookOpen,
          color: 'bg-green-500'
        },
        {
          name: 'Active Users',
          value: stats.users?.active || 0,
          change: `${Math.round((stats.users?.active / stats.users?.total) * 100) || 0}% of total`,
          icon: Activity,
          color: 'bg-yellow-500'
        },
        {
          name: 'Published Courses',
          value: stats.courses?.published || 0,
          change: `${Math.round((stats.courses?.published / stats.courses?.total) * 100) || 0}% of total`,
          icon: Award,
          color: 'bg-purple-500'
        }
      ];
    } else {
      // Student/Instructor stats
      return [
        {
          name: 'Enrolled Courses',
          value: user?.enrolledCourses?.length || 0,
          change: 'Active enrollments',
          icon: BookOpen,
          color: 'bg-blue-500'
        },
        {
          name: 'Completed',
          value: user?.enrolledCourses?.filter(c => c.progress === 100).length || 0,
          change: 'Courses finished',
          icon: CheckCircle,
          color: 'bg-green-500'
        },
        {
          name: 'In Progress',
          value: user?.enrolledCourses?.filter(c => c.progress > 0 && c.progress < 100).length || 0,
          change: 'Currently studying',
          icon: Clock,
          color: 'bg-yellow-500'
        },
        {
          name: 'Created Courses',
          value: user?.createdCourses?.length || 0,
          change: hasRole('instructor') ? 'Your courses' : 'Not applicable',
          icon: Award,
          color: 'bg-purple-500'
        }
      ];
    }
  };

  const statsData = getStatsForRole();

  return (
    <div className="p-6">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {getGreeting()}, {user?.firstName}!
        </h1>
        <p className="text-gray-600">
          Welcome to your {user?.role} dashboard. Here's what's happening today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statsData.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`p-3 rounded-md ${stat.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stat.value}
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm text-gray-500">
                    {stat.change}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Recent Activity
            </h3>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <Activity className="h-4 w-4 text-gray-500" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.action?.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No recent activity</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              {hasRole('admin') && (
                <>
                  <button className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-blue-600 mr-3" />
                      <span className="text-sm font-medium text-blue-900">Manage Users</span>
                    </div>
                  </button>
                  <button className="w-full text-left px-4 py-2 bg-green-50 hover:bg-green-100 rounded-md transition-colors">
                    <div className="flex items-center">
                      <BarChart3 className="h-5 w-5 text-green-600 mr-3" />
                      <span className="text-sm font-medium text-green-900">View Analytics</span>
                    </div>
                  </button>
                </>
              )}
              
              {hasRole('instructor') && (
                <>
                  <button className="w-full text-left px-4 py-2 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors">
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 text-purple-600 mr-3" />
                      <span className="text-sm font-medium text-purple-900">Create Course</span>
                    </div>
                  </button>
                  <button className="w-full text-left px-4 py-2 bg-yellow-50 hover:bg-yellow-100 rounded-md transition-colors">
                    <div className="flex items-center">
                      <Users className="h-5 w-5 text-yellow-600 mr-3" />
                      <span className="text-sm font-medium text-yellow-900">View Students</span>
                    </div>
                  </button>
                </>
              )}
              
              {hasRole('student') && (
                <>
                  <button className="w-full text-left px-4 py-2 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors">
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 text-blue-600 mr-3" />
                      <span className="text-sm font-medium text-blue-900">Browse Courses</span>
                    </div>
                  </button>
                  <button className="w-full text-left px-4 py-2 bg-green-50 hover:bg-green-100 rounded-md transition-colors">
                    <div className="flex items-center">
                      <TrendingUp className="h-5 w-5 text-green-600 mr-3" />
                      <span className="text-sm font-medium text-green-900">View Progress</span>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;