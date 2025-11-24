const express = require('express');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');
const { authenticateToken, requireRole, requirePermission } = require('../middleware/auth');
const { userValidations, queryValidations } = require('../middleware/validation');

const router = express.Router();

// Get all users (Admin only)
router.get('/', 
  authenticateToken, 
  requireRole('admin'), 
  queryValidations.pagination,
  queryValidations.search,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
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

      // Execute query
      const [users, total] = await Promise.all([
        User.find(query)
          .select('-password -emailVerificationToken -passwordResetToken')
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .populate('enrolledCourses.course', 'title')
          .populate('createdCourses', 'title'),
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
      logger.error('Get users error:', error);
      res.status(500).json({
        message: 'Failed to retrieve users',
        code: 'GET_USERS_ERROR'
      });
    }
  }
);

// Get user by ID
router.get('/:id', 
  authenticateToken, 
  userValidations.getUserById,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check permissions - users can view their own profile, admins can view any
      if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
        return res.status(403).json({
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const user = await User.findById(id)
        .select('-password -emailVerificationToken -passwordResetToken')
        .populate('enrolledCourses.course', 'title instructor')
        .populate('createdCourses', 'title enrollmentCount');

      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({ user });
    } catch (error) {
      logger.error('Get user by ID error:', error);
      res.status(500).json({
        message: 'Failed to retrieve user',
        code: 'GET_USER_ERROR'
      });
    }
  }
);

// Update user profile
router.put('/profile', 
  authenticateToken, 
  userValidations.updateProfile,
  async (req, res) => {
    try {
      const updates = req.body;
      const allowedUpdates = [
        'firstName', 'lastName', 'profile.bio', 'profile.phone', 
        'profile.address', 'profile.dateOfBirth', 'profile.gender',
        'preferences.notifications', 'preferences.theme', 'preferences.language'
      ];

      // Filter allowed updates
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: filteredUpdates },
        { new: true, runValidators: true }
      ).select('-password -emailVerificationToken -passwordResetToken');

      // Create audit log
      await AuditLog.createLog({
        user: req.user._id,
        action: 'USER_UPDATE',
        resource: 'User',
        resourceId: req.user._id,
        details: { updatedFields: Object.keys(filteredUpdates) },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'LOW',
        status: 'SUCCESS'
      });

      res.json({
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        message: 'Failed to update profile',
        code: 'UPDATE_PROFILE_ERROR'
      });
    }
  }
);

// Update user (Admin only)
router.put('/:id', 
  authenticateToken, 
  requireRole('admin'), 
  userValidations.updateUser,
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Prevent admin from deactivating themselves
      if (id === req.user._id.toString() && updates.isActive === false) {
        return res.status(400).json({
          message: 'Cannot deactivate your own account',
          code: 'CANNOT_DEACTIVATE_SELF'
        });
      }

      // Update user
      Object.assign(user, updates);
      await user.save();

      // Create audit log
      await AuditLog.createLog({
        user: req.user._id,
        action: 'USER_UPDATE',
        resource: 'User',
        resourceId: id,
        details: { 
          updatedFields: Object.keys(updates),
          targetUser: user.email,
          changes: updates
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'MEDIUM',
        status: 'SUCCESS'
      });

      const updatedUser = await User.findById(id)
        .select('-password -emailVerificationToken -passwordResetToken');

      res.json({
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      logger.error('Update user error:', error);
      res.status(500).json({
        message: 'Failed to update user',
        code: 'UPDATE_USER_ERROR'
      });
    }
  }
);

// Delete user (Admin only)
router.delete('/:id', 
  authenticateToken, 
  requireRole('admin'), 
  userValidations.getUserById,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Prevent admin from deleting themselves
      if (id === req.user._id.toString()) {
        return res.status(400).json({
          message: 'Cannot delete your own account',
          code: 'CANNOT_DELETE_SELF'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Soft delete - deactivate instead of removing
      user.isActive = false;
      user.email = `deleted_${Date.now()}_${user.email}`;
      await user.save();

      // Create audit log
      await AuditLog.createLog({
        user: req.user._id,
        action: 'USER_DELETE',
        resource: 'User',
        resourceId: id,
        details: { 
          targetUser: user.email,
          deletedBy: req.user.email
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'HIGH',
        status: 'SUCCESS'
      });

      res.json({
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({
        message: 'Failed to delete user',
        code: 'DELETE_USER_ERROR'
      });
    }
  }
);

// Get user statistics (Admin only)
router.get('/stats/overview', 
  authenticateToken, 
  requireRole('admin'),
  async (req, res) => {
    try {
      const [
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        usersByRole,
        recentUsers
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({
          createdAt: { $gte: new Date(new Date().setDate(1)) }
        }),
        User.aggregate([
          { $group: { _id: '$role', count: { $sum: 1 } } }
        ]),
        User.find()
          .select('firstName lastName email role createdAt')
          .sort({ createdAt: -1 })
          .limit(10)
      ]);

      const stats = {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        newUsersThisMonth,
        usersByRole: usersByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentUsers
      };

      res.json({ stats });
    } catch (error) {
      logger.error('Get user stats error:', error);
      res.status(500).json({
        message: 'Failed to retrieve user statistics',
        code: 'GET_STATS_ERROR'
      });
    }
  }
);

// Get user activity (Admin can view any, users can view their own)
router.get('/:id/activity', 
  authenticateToken, 
  userValidations.getUserById,
  async (req, res) => {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      // Check permissions
      if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
        return res.status(403).json({
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const activity = await AuditLog.getUserActivity(id, limit);

      res.json({ activity });
    } catch (error) {
      logger.error('Get user activity error:', error);
      res.status(500).json({
        message: 'Failed to retrieve user activity',
        code: 'GET_ACTIVITY_ERROR'
      });
    }
  }
);

module.exports = router;