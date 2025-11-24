const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendEmail } = require('../utils/email');
const { logger } = require('../utils/logger');
const { authValidations } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Generate refresh token
const generateRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};

// Register
router.post('/register', authValidations.register, async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'student' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      role,
      emailVerificationToken,
    });

    await user.save();

    // Create audit log
    await AuditLog.createLog({
      user: user._id,
      action: 'REGISTER',
      resource: 'User',
      resourceId: user._id,
      details: { email, role },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'LOW',
      status: 'SUCCESS'
    });

    // Send verification email
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${emailVerificationToken}`;
    try {
      await sendEmail(email, 'welcome', { 
        name: firstName, 
        verificationUrl 
      });
    } catch (emailError) {
      logger.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification.',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      message: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
});

// Login
router.post('/login', authValidations.login, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        message: 'Account is temporarily locked due to too many failed login attempts',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      // Create audit log for failed login
      await AuditLog.createLog({
        user: user._id,
        action: 'LOGIN',
        resource: 'User',
        resourceId: user._id,
        details: { email, reason: 'Invalid password' },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'MEDIUM',
        status: 'FAILURE'
      });

      return res.status(401).json({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Create audit log for successful login
    await AuditLog.createLog({
      user: user._id,
      action: 'LOGIN',
      resource: 'User',
      resourceId: user._id,
      details: { email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'LOW',
      status: 'SUCCESS'
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Create audit log
    await AuditLog.createLog({
      user: req.user._id,
      action: 'LOGOUT',
      resource: 'User',
      resourceId: req.user._id,
      details: {},
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'LOW',
      status: 'SUCCESS'
    });

    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      message: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        message: 'Verification token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    const user = await User.findOne({ emailVerificationToken: token });
    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification token',
        code: 'INVALID_TOKEN'
      });
    }

    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    await user.save();

    // Create audit log
    await AuditLog.createLog({
      user: user._id,
      action: 'EMAIL_VERIFY',
      resource: 'User',
      resourceId: user._id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'LOW',
      status: 'SUCCESS'
    });

    res.json({
      message: 'Email verified successfully',
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({
      message: 'Email verification failed',
      code: 'VERIFICATION_ERROR'
    });
  }
});

// Forgot password
router.post('/forgot-password', authValidations.forgotPassword, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({
        message: 'If an account with that email exists, we have sent a password reset link.',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    // Send reset email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    try {
      await sendEmail(email, 'passwordReset', {
        name: user.firstName,
        resetUrl,
      });
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError);
      return res.status(500).json({
        message: 'Failed to send password reset email',
        code: 'EMAIL_SEND_ERROR'
      });
    }

    // Create audit log
    await AuditLog.createLog({
      user: user._id,
      action: 'PASSWORD_RESET',
      resource: 'User',
      resourceId: user._id,
      details: { email, action: 'requested' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'MEDIUM',
      status: 'SUCCESS'
    });

    res.json({
      message: 'If an account with that email exists, we have sent a password reset link.',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.status(500).json({
      message: 'Password reset request failed',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
});

// Reset password
router.post('/reset-password', authValidations.resetPassword, async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token',
        code: 'INVALID_TOKEN'
      });
    }

    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Send confirmation email
    try {
      await sendEmail(user.email, 'passwordChanged', {
        name: user.firstName,
      });
    } catch (emailError) {
      logger.error('Failed to send password change confirmation email:', emailError);
    }

    // Create audit log
    await AuditLog.createLog({
      user: user._id,
      action: 'PASSWORD_RESET',
      resource: 'User',
      resourceId: user._id,
      details: { email: user.email, action: 'completed' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'MEDIUM',
      status: 'SUCCESS'
    });

    res.json({
      message: 'Password reset successful',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      message: 'Password reset failed',
      code: 'PASSWORD_RESET_ERROR'
    });
  }
});

// Change password (authenticated)
router.post('/change-password', authenticateToken, authValidations.changePassword, async (req, res) => {
  try {
    const { currentPassword, password } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Update password
    user.password = password;
    await user.save();

    // Send confirmation email
    try {
      await sendEmail(user.email, 'passwordChanged', {
        name: user.firstName,
      });
    } catch (emailError) {
      logger.error('Failed to send password change confirmation email:', emailError);
    }

    // Create audit log
    await AuditLog.createLog({
      user: user._id,
      action: 'PASSWORD_RESET',
      resource: 'User',
      resourceId: user._id,
      details: { email: user.email, action: 'changed' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      severity: 'MEDIUM',
      status: 'SUCCESS'
    });

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({
      message: 'Password change failed',
      code: 'PASSWORD_CHANGE_ERROR'
    });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('enrolledCourses.course', 'title instructor')
      .populate('createdCourses', 'title enrollmentCount');

    res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        profile: user.profile,
        preferences: user.preferences,
        enrolledCourses: user.enrolledCourses,
        createdCourses: user.createdCourses,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      message: 'Failed to get user information',
      code: 'GET_USER_ERROR'
    });
  }
});

module.exports = router;