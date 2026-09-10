/**
 * Authentication Middleware
 * Verifies JWT tokens and protects routes
 */

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'your-secret-key-change-in-production';

/**
 * Verify JWT token and attach user to request
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
export async function authenticateToken(req, res, next) {
  try {
    // Get token from Authorization header or cookie
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    const cookieToken = req.cookies?.auth_token;
    
    const finalToken = token || cookieToken;
    
    if (!finalToken) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
    }

    // Verify token
    const decoded = jwt.verify(finalToken, JWT_SECRET);
    
    // Check if session exists and is valid
    const session = await prisma.session.findUnique({
      where: { token: finalToken },
      include: { user: true }
    });

    if (!session) {
      return res.status(401).json({ 
        error: 'Invalid or expired session',
        code: 'INVALID_SESSION'
      });
    }

    // Check if session expired
    if (new Date() > session.expiresAt) {
      // Delete expired session
      await prisma.session.delete({ where: { id: session.id } });
      return res.status(401).json({ 
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }

    // Attach user to request
    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      isEmailVerified: session.user.isEmailVerified,
    };
    req.sessionId = session.id;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Optional authentication - doesn't block if no token
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const cookieToken = req.cookies?.auth_token;
    
    const finalToken = token || cookieToken;
    
    if (!finalToken) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(finalToken, JWT_SECRET);
    const session = await prisma.session.findUnique({
      where: { token: finalToken },
      include: { user: true }
    });

    if (session && new Date() <= session.expiresAt) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
      };
      req.sessionId = session.id;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

/**
 * Require admin role
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NO_AUTH'
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ 
      error: 'Admin access required',
      code: 'FORBIDDEN'
    });
  }

  next();
}

/**
 * Require email verification
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
export function requireEmailVerified(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'NO_AUTH'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  next();
}

/**
 * Rate limiter for auth routes
 */
export const authRateLimiter = new Map();

export function rateLimit(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!authRateLimiter.has(key)) {
      authRateLimiter.set(key, { attempts: 1, resetTime: now + windowMs });
      return next();
    }

    const limiter = authRateLimiter.get(key);
    
    // Reset if window expired
    if (now > limiter.resetTime) {
      authRateLimiter.set(key, { attempts: 1, resetTime: now + windowMs });
      return next();
    }

    // Increment attempts
    limiter.attempts++;
    
    if (limiter.attempts > maxAttempts) {
      const retryAfter = Math.ceil((limiter.resetTime - now) / 1000);
      return res.status(429).json({ 
        error: 'Too many attempts. Please try again later.',
        retryAfter,
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    next();
  };
}

// Clean up expired sessions periodically
setInterval(async () => {
  try {
    const deleted = await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    if (deleted.count > 0) {
      console.log(`🧹 Cleaned up ${deleted.count} expired sessions`);
    }
  } catch (error) {
    console.error('Session cleanup error:', error);
  }
}, 60 * 60 * 1000); // Run every hour
