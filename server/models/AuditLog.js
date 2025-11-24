const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN', 'LOGOUT', 'REGISTER', 'PASSWORD_RESET', 'EMAIL_VERIFY',
      'USER_CREATE', 'USER_UPDATE', 'USER_DELETE', 'USER_ROLE_CHANGE',
      'COURSE_CREATE', 'COURSE_UPDATE', 'COURSE_DELETE', 'COURSE_PUBLISH',
      'ASSIGNMENT_CREATE', 'ASSIGNMENT_UPDATE', 'ASSIGNMENT_DELETE',
      'GRADE_CREATE', 'GRADE_UPDATE', 'ENROLLMENT_CREATE', 'ENROLLMENT_DELETE',
      'SYSTEM_CONFIG_UPDATE', 'BACKUP_CREATE', 'BACKUP_RESTORE'
    ]
  },
  resource: {
    type: String,
    required: true // e.g., 'User', 'Course', 'Assignment'
  },
  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: String,
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW'
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'WARNING'],
    default: 'SUCCESS'
  }
}, {
  timestamps: true
});

// Indexes
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

// Static method to create audit log
auditLogSchema.statics.createLog = function(logData) {
  return this.create(logData);
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = function(userId, limit = 50) {
  return this.find({ user: userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'firstName lastName email');
};

// Static method to get system activity
auditLogSchema.statics.getSystemActivity = function(filters = {}, limit = 100) {
  const query = {};
  
  if (filters.action) query.action = filters.action;
  if (filters.resource) query.resource = filters.resource;
  if (filters.severity) query.severity = filters.severity;
  if (filters.status) query.status = filters.status;
  if (filters.startDate && filters.endDate) {
    query.timestamp = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate)
    };
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'firstName lastName email role');
};

module.exports = mongoose.model('AuditLog', auditLogSchema);