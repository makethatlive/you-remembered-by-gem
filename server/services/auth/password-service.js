/**
 * Password Service
 * Handles password hashing, verification, and reset
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../email/resend-client.js';
import { passwordResetEmail, emailVerificationEmail } from '../email/email-template.js';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;
const PASSWORD_RESET_EXPIRES = 60 * 60 * 1000; // 1 hour in ms
const EMAIL_VERIFICATION_EXPIRES = 24 * 60 * 60 * 1000; // 24 hours in ms

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} Match result
 */
export async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result
 */
export function validatePasswordStrength(password) {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate password reset token
 * @param {string} email - User email
 * @returns {Promise<object>} Result with token or error
 */
export async function generatePasswordResetToken(email) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if user exists or not
      return { 
        success: true, 
        message: 'If the email exists, a reset link has been sent' 
      };
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES);

    // Save token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpires: expiresAt,
      }
    });

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    
    const emailData = passwordResetEmail(user, resetUrl);

    await sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    return { 
      success: true, 
      message: 'Password reset email sent' 
    };
  } catch (error) {
    console.error('Generate password reset token error:', error);
    return { 
      success: false, 
      error: 'Failed to generate reset token' 
    };
  }
}

/**
 * Reset password using token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Promise<object>} Result
 */
export async function resetPassword(token, newPassword) {
  try {
    // Hash the token to match database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      return { 
        success: false, 
        error: 'Invalid or expired reset token' 
      };
    }

    // Validate new password
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return { 
        success: false, 
        error: validation.errors[0] 
      };
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      }
    });

    // Revoke all existing sessions (force re-login)
    await prisma.session.deleteMany({
      where: { userId: user.id }
    });

    return { 
      success: true, 
      message: 'Password reset successfully' 
    };
  } catch (error) {
    console.error('Reset password error:', error);
    return { 
      success: false, 
      error: 'Failed to reset password' 
    };
  }
}

/**
 * Generate email verification token
 * @param {string} userId - User ID
 * @returns {Promise<string>} Verification token
 */
export async function generateEmailVerificationToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: token,
    }
  });

  return token;
}

/**
 * Send email verification
 * @param {object} user - User object
 * @returns {Promise<object>} Result
 */
export async function sendEmailVerification(user) {
  try {
    const token = await generateEmailVerificationToken(user.id);
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;

    const emailData = emailVerificationEmail(user, verificationUrl);

    await sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html,
    });

    return { success: true };
  } catch (error) {
    console.error('Send email verification error:', error);
    return { success: false, error: 'Failed to send verification email' };
  }
}

/**
 * Verify email with token
 * @param {string} token - Verification token
 * @returns {Promise<object>} Result
 */
export async function verifyEmail(token) {
  try {
    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token }
    });

    if (!user) {
      return { 
        success: false, 
        error: 'Invalid verification token' 
      };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
      }
    });

    return { 
      success: true, 
      message: 'Email verified successfully' 
    };
  } catch (error) {
    console.error('Verify email error:', error);
    return { 
      success: false, 
      error: 'Failed to verify email' 
    };
  }
}

/**
 * Change password (for authenticated users)
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<object>} Result
 */
export async function changePassword(userId, currentPassword, newPassword) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.password) {
      return { 
        success: false, 
        error: 'User not found' 
      };
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      return { 
        success: false, 
        error: 'Current password is incorrect' 
      };
    }

    // Validate new password
    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      return { 
        success: false, 
        error: validation.errors[0] 
      };
    }

    // Hash and update
    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    return { 
      success: true, 
      message: 'Password changed successfully' 
    };
  } catch (error) {
    console.error('Change password error:', error);
    return { 
      success: false, 
      error: 'Failed to change password' 
    };
  }
}
