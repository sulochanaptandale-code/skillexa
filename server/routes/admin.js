const express = require('express');
const User = require('../models/User');
const Course = require('../models/Course');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { queryValidations } = require('../middleware/validation');

const router = express.Router();

// All routes require admin role
router.use(authenticateToken);
router.use(requireRole('admin'));

// Dashboard overview
router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));

    const [
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      newCoursesToday,
      newCoursesThisWeek,
      newCoursesThisMonth,
      usersByRole,
      coursesByCategory,
      recentActivity
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      Course.countDocuments(),
      Course.countDocuments({ isPublished: true }),
      User.countDocuments({ createdAt: { $gte: startOfDay } }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Course.countDocuments({ createdAt: { $gte: startOfDay } }),
      Course.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Course.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      Course.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      AuditLog.getSystemActivity({}, 20)
    ]);

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersThisWeek,
        newThisMonth: newUsersThisMonth,
        byRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      courses: {
        total: totalCourses,
        published: publishedCourses,
        draft: totalCourses - publishedCourses,
        newToday: newCoursesToday,
        newThisWeek: newCoursesThisWeek,
        newThisMonth: newCoursesThisMonth,
        byCategory: coursesByCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      },
      recentActivity
    };

    res.json({ stats });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({
      message: 'Failed to load dashboard data',
      code: 'DASHBOARD_ERROR'
    });
  }
});

// System analytics
router.get('/analytics', queryValidations.pagination, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // User registration trends
    const userRegistrations = await User.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Course creation trends
    const courseCreations = await Course.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Activity by action type
    const activityByAction = await AuditLog.aggregate([
      {
        $match: { timestamp: { $gte: startDate } }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Top active users
    const topActiveUsers = await AuditLog.aggregate([
      {
        $match: { timestamp: { $gte: startDate } }
      },
      {
        $group: {
          _id: '$user',
          activityCount: { $sum: 1 }
        }
      },
      { $sort: { activityCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          activityCount: 1,
          'user.firstName': 1,
          'user.lastName': 1,
          'user.email': 1,
          'user.role': 1
        }
      }
    ]);

    const analytics = {
      period: `${days} days`,
      userRegistrations,
      courseCreations,
      activityByAction,
      topActiveUsers
    };

    res.json({ analytics });
  } catch (error) {
    logger.error('Admin analytics error:', error);
    res.status(500).json({
      message: 'Failed to load analytics data',
      code: 'ANALYTICS_ERROR'
    });
  }
});

// System audit logs
router.get('/audit-logs', queryValidations.pagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const action = req.query.action;
    const severity = req.query.severity;
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const filters = {};
    if (action) filters.action = action;
    if (severity) filters.severity = severity;
    if (status) filters.status = status;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }

    const [logs, total] = await Promise.all([
      AuditLog.getSystemActivity(filters, limit),
      AuditLog.countDocuments(filters)
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Admin audit logs error:', error);
    res.status(500).json({
      message: 'Failed to load audit logs',
      code: 'AUDIT_LOGS_ERROR'
    });
  }
});

// User management
router.get('/users', queryValidations.pagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.q || '';
    const role = req.query.role;
    const isActive = req.query.isActive;
    const sort = req.query.sort || 'createdAt:desc';

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    // Build sort
    const [sortField, sortOrder] = sort.split(':');
    const sortObj = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -emailVerificationToken -passwordResetToken')
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Admin users error:', error);
    res.status(500).json({
      message: 'Failed to load users',
      code: 'USERS_ERROR'
    });
  }
});

// Course management
router.get('/courses', queryValidations.pagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.q || '';
    const category = req.query.category;
    const isPublished = req.query.isPublished;
    const sort = req.query.sort || 'createdAt:desc';

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    if (isPublished !== undefined) query.isPublished = isPublished === 'true';

    // Build sort
    const [sortField, sortOrder] = sort.split(':');
    const sortObj = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

    const [courses, total] = await Promise.all([
      Course.find(query)
        .populate('instructor', 'firstName lastName email')
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      Course.countDocuments(query)
    ]);

    res.json({
      courses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Admin courses error:', error);
    res.status(500).json({
      message: 'Failed to load courses',
      code: 'COURSES_ERROR'
    });
  }
});

// System settings
router.get('/settings', async (req, res) => {
  try {
    // In a real application, you would store these in a database
    const settings = {
      general: {
        siteName: 'RBAC Learning Platform',
        siteDescription: 'A comprehensive role-based access control learning management system',
        contactEmail: 'admin@rbacapp.com',
        supportEmail: 'support@rbacapp.com',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h'
      },
      security: {
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecialChars: true,
        maxLoginAttempts: 5,
        lockoutDuration: 120, // minutes
        sessionTimeout: 7, // days
        twoFactorRequired: false
      },
      email: {
        smtpHost: process.env.EMAIL_HOST || '',
        smtpPort: process.env.EMAIL_PORT || 587,
        smtpSecure: process.env.EMAIL_SECURE === 'true',
        fromAddress: process.env.EMAIL_FROM || 'noreply@rbacapp.com',
        fromName: 'RBAC App'
      },
      features: {
        userRegistration: true,
        emailVerification: true,
        courseCreation: true,
        fileUploads: true,
        notifications: true,
        analytics: true
      },
      limits: {
        maxFileSize: 10, // MB
        maxCoursesPerInstructor: 50,
        maxStudentsPerCourse: 1000,
        maxAssignmentsPerCourse: 100
      }
    };

    res.json({ settings });
  } catch (error) {
    logger.error('Admin settings error:', error);
    res.status(500).json({
      message: 'Failed to load settings',
      code: 'SETTINGS_ERROR'
    });
  }
});

// Update system settings
router.put('/settings', async (req, res) => {
  try {
    const { settings } = req.body;

    // In a real application, you would validate and save these to a database
    // For now, we'll just log the update and return success

    // Create audit log
    await AuditLog.createLog({
      user: req.user._id,
      action: 'SYSTEM_CONFIG_UPDATE',
      resource: 'System',
      resourceId: req.user._id,
      details: { 
        updatedSettings: Object.keys(settings),
        changes: settings
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'HIGH',
      status: 'SUCCESS'
    });

    logger.info('System settings updated by admin:', {
      admin: req.user.email,
      settings: Object.keys(settings)
    });

    res.json({
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    logger.error('Admin update settings error:', error);
    res.status(500).json({
      message: 'Failed to update settings',
      code: 'UPDATE_SETTINGS_ERROR'
    });
  }
});

// System health check
router.get('/health', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        name: mongoose.connection.name
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json({ health });
  } catch (error) {
    logger.error('Admin health check error:', error);
    res.status(500).json({
      message: 'Health check failed',
      code: 'HEALTH_CHECK_ERROR'
    });
  }
});

// Export data
router.get('/export/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const format = req.query.format || 'json';

    let data;
    let filename;

    switch (type) {
      case 'users':
        data = await User.find()
          .select('-password -emailVerificationToken -passwordResetToken')
          .lean();
        filename = `users_export_${Date.now()}`;
        break;
      
      case 'courses':
        data = await Course.find()
          .populate('instructor', 'firstName lastName email')
          .lean();
        filename = `courses_export_${Date.now()}`;
        break;
      
      case 'audit-logs':
        data = await AuditLog.find()
          .populate('user', 'firstName lastName email')
          .sort({ timestamp: -1 })
          .limit(10000)
          .lean();
        filename = `audit_logs_export_${Date.now()}`;
        break;
      
      default:
        return res.status(400).json({
          message: 'Invalid export type',
          code: 'INVALID_EXPORT_TYPE'
        });
    }

    // Create audit log
    await AuditLog.createLog({
      user: req.user._id,
      action: 'DATA_EXPORT',
      resource: 'System',
      resourceId: req.user._id,
      details: { 
        exportType: type,
        format,
        recordCount: data.length
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'MEDIUM',
      status: 'SUCCESS'
    });

    if (format === 'csv') {
      // Convert to CSV (simplified implementation)
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(data);
    }
  } catch (error) {
    logger.error('Admin export error:', error);
    res.status(500).json({
      message: 'Export failed',
      code: 'EXPORT_ERROR'
    });
  }
});

// Helper function to convert JSON to CSV
function convertToCSV(data) {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

module.exports = router;