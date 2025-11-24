const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

// Verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid token - user not found',
        code: 'INVALID_TOKEN'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    if (user.isLocked) {
      return res.status(401).json({ 
        message: 'Account is temporarily locked',
        code: 'ACCOUNT_LOCKED'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    res.status(500).json({ 
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

// Check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      // Log unauthorized access attempt
      AuditLog.createLog({
        user: req.user._id,
        action: 'UNAUTHORIZED_ACCESS',
        resource: 'System',
        resourceId: req.user._id,
        details: {
          requiredRoles: roles,
          userRole: req.user.role,
          endpoint: req.originalUrl,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'HIGH',
        status: 'FAILURE'
      });

      return res.status(403).json({ 
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Check if user has specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!req.user.hasPermission(permission)) {
      // Log unauthorized access attempt
      AuditLog.createLog({
        user: req.user._id,
        action: 'UNAUTHORIZED_ACCESS',
        resource: 'System',
        resourceId: req.user._id,
        details: {
          requiredPermission: permission,
          userRole: req.user.role,
          endpoint: req.originalUrl,
          method: req.method
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'HIGH',
        status: 'FAILURE'
      });

      return res.status(403).json({ 
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permission,
        role: req.user.role
      });
    }

    next();
  };
};

// Check if user owns resource or has admin/instructor privileges
const requireOwnershipOrRole = (resourceField = 'user', allowedRoles = ['admin']) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Admin and specified roles have access to all resources
      if (allowedRoles.includes(req.user.role)) {
        return next();
      }

      // For other users, check ownership
      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({ 
          message: 'Resource ID required',
          code: 'RESOURCE_ID_REQUIRED'
        });
      }

      // This middleware assumes the resource will be fetched in the route handler
      // and ownership will be verified there, or the resource is passed in req.resource
      if (req.resource && req.resource[resourceField]) {
        const ownerId = req.resource[resourceField].toString();
        const userId = req.user._id.toString();
        
        if (ownerId !== userId) {
          return res.status(403).json({ 
            message: 'Access denied - not resource owner',
            code: 'NOT_RESOURCE_OWNER'
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      res.status(500).json({ 
        message: 'Authorization check failed',
        code: 'AUTH_CHECK_ERROR'
      });
    }
  };
};

// Optional authentication (for public routes that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive && !user.isLocked) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireOwnershipOrRole,
  optionalAuth
};