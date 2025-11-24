const nodemailer = require('nodemailer');
const { logger } = require('./logger');

// Create transporter
const createTransporter = () => {
  if (process.env.NODE_ENV === 'production') {
    // Production email configuration (e.g., SendGrid, AWS SES, etc.)
    return nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    // Development configuration (Ethereal Email for testing)
    return nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass',
      },
    });
  }
};

const transporter = createTransporter();

// Email templates
const emailTemplates = {
  welcome: (name, verificationUrl) => ({
    subject: 'Welcome to RBAC App - Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to RBAC App, ${name}!</h2>
        <p>Thank you for registering with us. To complete your registration, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
        </div>
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p>This verification link will expire in 24 hours.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">If you didn't create an account with us, please ignore this email.</p>
      </div>
    `,
  }),

  passwordReset: (name, resetUrl) => ({
    subject: 'Password Reset Request - RBAC App',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p>This password reset link will expire in 1 hour.</p>
        <p><strong>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</strong></p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">For security reasons, this link can only be used once.</p>
      </div>
    `,
  }),

  passwordChanged: (name) => ({
    subject: 'Password Changed Successfully - RBAC App',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Changed Successfully</h2>
        <p>Hello ${name},</p>
        <p>Your password has been successfully changed. If you made this change, no further action is required.</p>
        <p><strong>If you didn't change your password, please contact our support team immediately.</strong></p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Security Tips:</h3>
          <ul style="color: #666;">
            <li>Use a strong, unique password</li>
            <li>Enable two-factor authentication</li>
            <li>Don't share your login credentials</li>
            <li>Log out from shared devices</li>
          </ul>
        </div>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">This is an automated security notification.</p>
      </div>
    `,
  }),

  courseEnrollment: (studentName, courseName, instructorName) => ({
    subject: `Welcome to ${courseName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to ${courseName}!</h2>
        <p>Hello ${studentName},</p>
        <p>Congratulations! You have successfully enrolled in <strong>${courseName}</strong>.</p>
        <p>Your instructor, ${instructorName}, will guide you through this learning journey.</p>
        <div style="background-color: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
          <ul style="color: #666;">
            <li>Access your course materials in the dashboard</li>
            <li>Complete assignments on time</li>
            <li>Participate in discussions</li>
            <li>Track your progress</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.CLIENT_URL}/dashboard" style="background-color: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Dashboard</a>
        </div>
        <p>Happy learning!</p>
      </div>
    `,
  }),
};

// Send email function
const sendEmail = async (to, template, data = {}) => {
  try {
    const emailContent = emailTemplates[template];
    if (!emailContent) {
      throw new Error(`Email template '${template}' not found`);
    }

    const { subject, html } = typeof emailContent === 'function' 
      ? emailContent(...Object.values(data))
      : emailContent;

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@rbacapp.com',
      to,
      subject,
      html,
    };

    const result = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent successfully to ${to}`, {
      messageId: result.messageId,
      template,
    });

    return result;
  } catch (error) {
    logger.error('Email sending failed:', {
      to,
      template,
      error: error.message,
    });
    throw error;
  }
};

// Bulk email function
const sendBulkEmail = async (recipients, template, data = {}) => {
  const results = [];
  const errors = [];

  for (const recipient of recipients) {
    try {
      const result = await sendEmail(recipient, template, data);
      results.push({ recipient, success: true, messageId: result.messageId });
    } catch (error) {
      errors.push({ recipient, success: false, error: error.message });
    }
  }

  return { results, errors };
};

// Verify transporter configuration
const verifyEmailConfig = async () => {
  try {
    await transporter.verify();
    logger.info('Email transporter verified successfully');
    return true;
  } catch (error) {
    logger.error('Email transporter verification failed:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  verifyEmailConfig,
  emailTemplates,
};