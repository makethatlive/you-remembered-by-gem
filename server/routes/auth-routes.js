/**
 * Authentication Routes
 * Handles login, register, password reset, email verification
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { 
  hashPassword, 
  verifyPassword, 
  validatePasswordStrength,
  generatePasswordResetToken,
  resetPassword,
  sendEmailVerification,
  verifyEmail,
  changePassword 
} from '../services/auth/password-service.js';
import { 
  createSession, 
  refreshAccessToken, 
  revokeSession, 
  revokeAllSessions,
  getActiveSessions 
} from '../services/auth/jwt-service.js';
import { authenticateToken, rateLimit } from '../middleware/auth-middleware.js';
import { sendWelcomeEmail } from '../services/email/resend-client.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', 
  rateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 1, max: 50 }),
    body('lastName').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 1, max: 50 }),
  ],
  async (req, res) => {
    try {
      console.log('📥 Registration request body:', { 
        email: req.body.email,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        password: req.body.password ? '***' : undefined
      });
      
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ Validation errors:', errors.array());
        return res.status(400).json({ 
          error: errors.array()[0].msg || 'Invalid value',
          code: 'VALIDATION_ERROR',
          details: errors.array()
        });
      }

      const { email, password, firstName, lastName } = req.body;

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ 
          error: passwordValidation.errors[0],
          code: 'WEAK_PASSWORD'
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (existingUser) {
        return res.status(409).json({ 
          error: 'Email already registered',
          code: 'EMAIL_EXISTS'
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName: firstName || null,
          lastName: lastName || null,
          role: 'USER',
          isEmailVerified: false,
        }
      });

      // Create subscriber record immediately
      const subscriber = await prisma.subscriber.create({
        data: {
          name: `${firstName || ''} ${lastName || ''}`.trim() || email.split('@')[0],
          firstName: firstName || null,
          email: email.toLowerCase(),
          subscriptionStatus: 'TRIALLING',
          createdById: user.id,
        }
      });

      // Create session (NO email verification - matches base44 original)
      const session = await createSession(user, req);

      // Send welcome email with proper subscriberId (non-blocking)
      sendWelcomeEmail(subscriber.email, subscriber.firstName || subscriber.name, subscriber.id)
        .catch(err => console.error('Welcome email error:', err));

      res.status(201).json({
        success: true,
        message: 'Account created successfully. Welcome!',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.toLowerCase(), // Normalize to lowercase
          isEmailVerified: user.isEmailVerified,
        },
        auth: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn,
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ 
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login',
  rateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: errors.array()[0].msg,
          code: 'VALIDATION_ERROR'
        });
      }

      const { email, password } = req.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (!user || !user.password) {
        return res.status(401).json({ 
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ 
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // Create session
      const session = await createSession(user, req);

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.toLowerCase(), // Normalize to lowercase
          isEmailVerified: user.isEmailVerified,
        },
        auth: {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn,
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user (revoke current session)
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await revokeSession(req.sessionId);
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all', authenticateToken, async (req, res) => {
  try {
    const count = await revokeAllSessions(req.user.id);
    res.json({ 
      success: true, 
      message: `Logged out from ${count} device(s)` 
    });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: errors.array()[0].msg,
          code: 'VALIDATION_ERROR'
        });
      }

      const { refreshToken } = req.body;

      const result = await refreshAccessToken(refreshToken, req);
      if (!result) {
        return res.status(401).json({ 
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      res.json({
        success: true,
        auth: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        },
        user: result.user
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ 
        error: 'Token refresh failed',
        code: 'REFRESH_ERROR'
      });
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isEmailVerified: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({ 
      user: {
        ...user,
        role: user.role.toLowerCase() // Normalize role to lowercase for frontend
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ 
      error: 'Failed to get user',
      code: 'GET_USER_ERROR'
    });
  }
});

/**
 * GET /api/auth/sessions
 * Get active sessions
 */
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await getActiveSessions(req.user.id);
    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ 
      error: 'Failed to get sessions',
      code: 'GET_SESSIONS_ERROR'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password',
  rateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: errors.array()[0].msg,
          code: 'VALIDATION_ERROR'
        });
      }

      const { email } = req.body;
      const result = await generatePasswordResetToken(email);

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ 
        error: 'Failed to process request',
        code: 'FORGOT_PASSWORD_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: errors.array()[0].msg,
          code: 'VALIDATION_ERROR'
        });
      }

      const { token, password } = req.body;
      const result = await resetPassword(token, password);

      if (!result.success) {
        return res.status(400).json({ 
          error: result.error,
          code: 'RESET_PASSWORD_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ 
        error: 'Failed to reset password',
        code: 'RESET_PASSWORD_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
router.post('/change-password', 
  authenticateToken,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: errors.array()[0].msg,
          code: 'VALIDATION_ERROR'
        });
      }

      const { currentPassword, newPassword } = req.body;
      const result = await changePassword(req.user.id, currentPassword, newPassword);

      if (!result.success) {
        return res.status(400).json({ 
          error: result.error,
          code: 'CHANGE_PASSWORD_FAILED'
        });
      }

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ 
        error: 'Failed to change password',
        code: 'CHANGE_PASSWORD_ERROR'
      });
    }
  }
);

/**
 * POST /api/auth/resend-verification
 * Resend email verification
 */
router.post('/resend-verification', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ 
        error: 'Email already verified',
        code: 'ALREADY_VERIFIED'
      });
    }

    const result = await sendEmailVerification(user);

    if (!result.success) {
      return res.status(500).json({ 
        error: 'Failed to send verification email',
        code: 'SEND_VERIFICATION_FAILED'
      });
    }

    res.json({
      success: true,
      message: 'Verification email sent'
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ 
      error: 'Failed to resend verification',
      code: 'RESEND_VERIFICATION_ERROR'
    });
  }
});

/**
 * GET /api/auth/verify-email
 * Verify email with token
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ 
        error: 'Verification token is required',
        code: 'MISSING_TOKEN'
      });
    }

    const result = await verifyEmail(token);

    if (!result.success) {
      return res.status(400).json({ 
        error: result.error,
        code: 'VERIFICATION_FAILED'
      });
    }

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ 
      error: 'Failed to verify email',
      code: 'VERIFY_EMAIL_ERROR'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile',
  authenticateToken,
  [
    body('firstName').optional().trim().isLength({ min: 1, max: 50 }),
    body('lastName').optional().trim().isLength({ min: 1, max: 50 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: errors.array()[0].msg,
          code: 'VALIDATION_ERROR'
        });
      }

      const { firstName, lastName } = req.body;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isEmailVerified: true,
        }
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ 
        error: 'Failed to update profile',
        code: 'UPDATE_PROFILE_ERROR'
      });
    }
  }
);

export default router;
