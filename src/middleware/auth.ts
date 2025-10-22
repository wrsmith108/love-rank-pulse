import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Extended Request interface with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role?: string;
  };
}

/**
 * JWT token payload interface
 */
interface JwtPayload {
  id: string;
  username: string;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * Environment configuration with defaults
 */
const JWT_SECRET = process.env.JWT_SECRET || 'default-dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Authentication middleware - Verifies JWT tokens
 * Attaches user information to request object
 *
 * @param required - If true, returns 401 for missing/invalid tokens
 */
export const authenticate = (required: boolean = true) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            message: 'No authorization header provided'
          });
        }
        return next();
      }

      // Check for Bearer token format
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        if (required) {
          return res.status(401).json({
            success: false,
            error: 'Invalid authentication format',
            message: 'Authorization header must be in format: Bearer <token>'
          });
        }
        return next();
      }

      const token = parts[1];

      // Verify JWT token
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

        // Attach user info to request
        req.user = {
          id: decoded.id,
          username: decoded.username,
          email: decoded.email,
          role: decoded.role
        };

        next();
      } catch (jwtError: any) {
        // Handle specific JWT errors
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Token expired',
            message: 'Your session has expired. Please login again.'
          });
        }

        if (jwtError.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            error: 'Invalid token',
            message: 'The provided token is invalid.'
          });
        }

        throw jwtError; // Re-throw unexpected errors
      }
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error',
        message: 'An error occurred during authentication'
      });
    }
  };
};

/**
 * Optional authentication - Attaches user if token is valid, continues otherwise
 */
export const optionalAuth = authenticate(false);

/**
 * Required authentication - Returns 401 if token is missing or invalid
 */
export const requireAuth = authenticate(true);

/**
 * Role-based authorization middleware
 * Requires authentication middleware to run first
 *
 * @param allowedRoles - Array of roles allowed to access the route
 */
export const authorize = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    const userRole = req.user.role || 'user';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
};

/**
 * Generate JWT token for a user
 *
 * @param payload - User information to encode in token
 * @param expiresIn - Token expiration time (default from env)
 * @returns Signed JWT token
 */
export const generateToken = (
  payload: { id: string; username: string; email: string; role?: string },
  expiresIn: string = JWT_EXPIRES_IN
): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn as string | number });
};

/**
 * Verify and decode JWT token without middleware
 *
 * @param token - JWT token to verify
 * @returns Decoded token payload or null
 */
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
};
