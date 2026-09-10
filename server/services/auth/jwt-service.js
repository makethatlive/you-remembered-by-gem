/**
 * JWT Service
 * Handles token generation, verification, and session management
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days default
const REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

/**
 * Generate JWT access token
 * @param {object} user - User object
 * @returns {string} JWT token
 */
export function generateAccessToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };

  return jwt.sign(payload, JWT_SECRET, { 
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'you-remembered-by-gem',
    audience: 'you-remembered-app',
  });
}

/**
 * Generate refresh token
 * @returns {string} Random refresh token
 */
export function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Create session with tokens
 * @param {object} user - User object
 * @param {object} req - Express request (for IP and user agent)
 * @returns {Promise<object>} Session with tokens
 */
export async function createSession(user, req) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  
  const expiresAt = new Date();
  expiresAt.setMilliseconds(expiresAt.getMilliseconds() + REFRESH_TOKEN_EXPIRES_IN);

  // Clean up old sessions for this user (optional - keep last 5)
  const existingSessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });

  if (existingSessions.length >= 5) {
    // Delete oldest sessions
    const sessionsToDelete = existingSessions.slice(4);
    await prisma.session.deleteMany({
      where: {
        id: {
          in: sessionsToDelete.map(s => s.id)
        }
      }
    });
  }

  // Create new session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: accessToken,
      refreshToken,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers['user-agent'],
      expiresAt,
    }
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: JWT_EXPIRES_IN,
    expiresAt,
    sessionId: session.id,
  };
}

/**
 * Verify and decode token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded payload or null
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'you-remembered-by-gem',
      audience: 'you-remembered-app',
    });
  } catch (error) {
    return null;
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @param {object} req - Express request
 * @returns {Promise<object|null>} New tokens or null
 */
export async function refreshAccessToken(refreshToken, req) {
  try {
    // Find session by refresh token
    const session = await prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true }
    });

    if (!session) {
      return null;
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      await prisma.session.delete({ where: { id: session.id } });
      return null;
    }

    // Generate new access token
    const accessToken = generateAccessToken(session.user);
    const newRefreshToken = generateRefreshToken();
    
    const expiresAt = new Date();
    expiresAt.setMilliseconds(expiresAt.getMilliseconds() + REFRESH_TOKEN_EXPIRES_IN);

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        token: accessToken,
        refreshToken: newRefreshToken,
        expiresAt,
      }
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: JWT_EXPIRES_IN,
      expiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        isEmailVerified: session.user.isEmailVerified,
      }
    };
  } catch (error) {
    console.error('Refresh token error:', error);
    return null;
  }
}

/**
 * Revoke session (logout)
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
export async function revokeSession(sessionId) {
  try {
    await prisma.session.delete({
      where: { id: sessionId }
    });
    return true;
  } catch (error) {
    console.error('Revoke session error:', error);
    return false;
  }
}

/**
 * Revoke all sessions for user (logout from all devices)
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of sessions revoked
 */
export async function revokeAllSessions(userId) {
  try {
    const result = await prisma.session.deleteMany({
      where: { userId }
    });
    return result.count;
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    return 0;
  }
}

/**
 * Get active sessions for user
 * @param {string} userId - User ID
 * @returns {Promise<array>} Active sessions
 */
export async function getActiveSessions(userId) {
  return await prisma.session.findMany({
    where: {
      userId,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      expiresAt: true,
    }
  });
}
