const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Common validation rules
const commonValidations = {
  email: body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  password: body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  name: (field) => body(field)
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage(`${field} must be between 2 and 50 characters`)
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage(`${field} can only contain letters, spaces, hyphens, and apostrophes`),
  
  objectId: (field) => param(field)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid ID format');
      }
      return true;
    }),
  
  role: body('role')
    .optional()
    .isIn(['student', 'instructor', 'admin'])
    .withMessage('Role must be student, instructor, or admin'),
  
  phone: body('phone')
    .optional()
    .matches(/^\+?[\d\s\-\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  url: (field) => body(field)
    .optional()
    .isURL()
    .withMessage(`${field} must be a valid URL`)
};

// Authentication validations
const authValidations = {
  register: [
    commonValidations.email,
    commonValidations.password,
    commonValidations.name('firstName'),
    commonValidations.name('lastName'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
    handleValidationErrors
  ],
  
  login: [
    commonValidations.email,
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
    handleValidationErrors
  ],
  
  forgotPassword: [
    commonValidations.email,
    handleValidationErrors
  ],
  
  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    commonValidations.password,
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
    handleValidationErrors
  ],
  
  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    commonValidations.password,
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      }),
    handleValidationErrors
  ]
};

// User validations
const userValidations = {
  updateProfile: [
    commonValidations.name('firstName').optional(),
    commonValidations.name('lastName').optional(),
    commonValidations.phone,
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must not exceed 500 characters'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid date of birth'),
    body('gender')
      .optional()
      .isIn(['male', 'female', 'other', 'prefer-not-to-say'])
      .withMessage('Invalid gender option'),
    handleValidationErrors
  ],
  
  updateUser: [
    commonValidations.objectId('id'),
    commonValidations.name('firstName').optional(),
    commonValidations.name('lastName').optional(),
    commonValidations.email.optional(),
    commonValidations.role,
    body('isActive')
      .optional()
      .isBoolean()
      .withMessage('isActive must be a boolean'),
    handleValidationErrors
  ],
  
  getUserById: [
    commonValidations.objectId('id'),
    handleValidationErrors
  ]
};

// Course validations
const courseValidations = {
  createCourse: [
    body('title')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Course title must be between 5 and 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 20, max: 2000 })
      .withMessage('Course description must be between 20 and 2000 characters'),
    body('shortDescription')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Short description must not exceed 500 characters'),
    body('category')
      .isIn(['programming', 'design', 'business', 'marketing', 'data-science', 'other'])
      .withMessage('Invalid course category'),
    body('level')
      .isIn(['beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid course level'),
    body('price')
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('prerequisites')
      .optional()
      .isArray()
      .withMessage('Prerequisites must be an array'),
    body('learningObjectives')
      .optional()
      .isArray()
      .withMessage('Learning objectives must be an array'),
    handleValidationErrors
  ],
  
  updateCourse: [
    commonValidations.objectId('id'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Course title must be between 5 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ min: 20, max: 2000 })
      .withMessage('Course description must be between 20 and 2000 characters'),
    body('category')
      .optional()
      .isIn(['programming', 'design', 'business', 'marketing', 'data-science', 'other'])
      .withMessage('Invalid course category'),
    body('level')
      .optional()
      .isIn(['beginner', 'intermediate', 'advanced'])
      .withMessage('Invalid course level'),
    body('price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a positive number'),
    handleValidationErrors
  ],
  
  getCourseById: [
    commonValidations.objectId('id'),
    handleValidationErrors
  ]
};

// Query validations
const queryValidations = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .matches(/^[a-zA-Z_]+(:asc|:desc)?$/)
      .withMessage('Invalid sort format'),
    handleValidationErrors
  ],
  
  search: [
    query('q')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Search query must be between 1 and 100 characters'),
    handleValidationErrors
  ]
};

module.exports = {
  handleValidationErrors,
  commonValidations,
  authValidations,
  userValidations,
  courseValidations,
  queryValidations
};