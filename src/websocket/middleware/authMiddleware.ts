import { Socket } from 'socket.io';
import { ExtendedError } from 'socket.io/dist/namespace';
import {
  verifySocketToken,
  attachUserToSocket,
  AuthenticatedSocket,
  disconnectWithError,
  getSocketUser,
  hasRole,
  hasAnyRole,
  hasAllRoles
} from '../auth';

/**
 * Socket.IO middleware for JWT authentication
 * This middleware runs during the handshake phase before connection is established
 *
 * Usage:
 * ```typescript
 * io.use(socketAuthMiddleware);
 * ```
 */
export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  try {
    // Verify token and get user data
    const user = await verifySocketToken(socket);

    // Attach user to socket
    attachUserToSocket(socket as AuthenticatedSocket, user);

    console.log(`✅ Socket authenticated: ${user.username} (${user.userId})`);

    // Allow connection
    next();
  } catch (error) {
    console.error('❌ Socket authentication failed:', error);

    // Create authentication error
    const authError = new Error(
      error instanceof Error ? error.message : 'Authentication failed'
    ) as ExtendedError;
    authError.data = {
      code: 'AUTH_FAILED',
      message: authError.message
    };

    // Reject connection
    next(authError);
  }
};

/**
 * Optional authentication middleware - allows both authenticated and unauthenticated connections
 * Sets authenticated flag to false if no token provided
 *
 * Usage:
 * ```typescript
 * io.use(optionalAuthMiddleware);
 * ```
 */
export const optionalAuthMiddleware = async (
  socket: Socket,
  next: (err?: ExtendedError) => void
): Promise<void> => {
  try {
    // Try to verify token
    const user = await verifySocketToken(socket);
    attachUserToSocket(socket as AuthenticatedSocket, user);
    console.log(`✅ Socket authenticated: ${user.username}`);
  } catch (error) {
    // Authentication failed, but allow connection anyway
    const authSocket = socket as AuthenticatedSocket;
    authSocket.data = authSocket.data || {};
    authSocket.data.authenticated = false;
    console.log(`⚠️  Socket connected without authentication`);
  }

  // Always allow connection
  next();
};

/**
 * Middleware factory for namespace-specific authentication
 * Allows different authentication rules for different namespaces
 *
 * @param options Configuration options
 * @returns Socket.IO middleware function
 *
 * Usage:
 * ```typescript
 * const chatNamespace = io.of('/chat');
 * chatNamespace.use(namespaceAuthMiddleware({ requireVerified: true }));
 * ```
 */
export function namespaceAuthMiddleware(options: {
  requireAuth?: boolean;
  requireVerified?: boolean;
  requiredRoles?: string[];
} = {}) {
  const {
    requireAuth = true,
    requireVerified = false,
    requiredRoles = []
  } = options;

  return async (socket: Socket, next: (err?: ExtendedError) => void): Promise<void> => {
    try {
      if (requireAuth) {
        // Require authentication
        const user = await verifySocketToken(socket);
        attachUserToSocket(socket as AuthenticatedSocket, user);

        // Check if email verification is required
        if (requireVerified && !user.isVerified) {
          throw new Error('Email verification required');
        }

        // Check required roles
        if (requiredRoles.length > 0) {
          const hasRequiredRole = requiredRoles.some(role =>
            user.roles?.includes(role)
          );
          if (!hasRequiredRole) {
            throw new Error('Insufficient permissions');
          }
        }

        console.log(`✅ Namespace authenticated: ${user.username}`);
      }

      next();
    } catch (error) {
      console.error('❌ Namespace authentication failed:', error);

      const authError = new Error(
        error instanceof Error ? error.message : 'Authentication failed'
      ) as ExtendedError;
      authError.data = {
        code: 'AUTH_FAILED',
        message: authError.message
      };

      next(authError);
    }
  };
}

/**
 * Middleware factory for room-specific authentication
 * Protects specific rooms with authentication and authorization checks
 *
 * @param roomName Name of the room to protect
 * @param options Configuration options
 * @returns Event handler function
 *
 * Usage:
 * ```typescript
 * socket.on('join:room', roomAuthMiddleware('vip-lounge', {
 *   requiredRoles: ['vip', 'admin']
 * }));
 * ```
 */
export function roomAuthMiddleware(
  roomName: string,
  options: {
    requireAuth?: boolean;
    requireVerified?: boolean;
    requiredRoles?: string[];
    customCheck?: (socket: Socket) => boolean | Promise<boolean>;
  } = {}
) {
  const {
    requireAuth = true,
    requireVerified = false,
    requiredRoles = [],
    customCheck
  } = options;

  return async (socket: Socket, callback?: (error?: Error) => void): Promise<void> => {
    try {
      // Get authenticated user
      const user = getSocketUser(socket);

      // Check authentication requirement
      if (requireAuth && !user) {
        throw new Error('Authentication required to join this room');
      }

      if (user) {
        // Check email verification
        if (requireVerified && !user.isVerified) {
          throw new Error('Email verification required to join this room');
        }

        // Check required roles
        if (requiredRoles.length > 0 && !hasAnyRole(socket, requiredRoles)) {
          throw new Error('Insufficient permissions to join this room');
        }
      }

      // Run custom check if provided
      if (customCheck) {
        const passed = await customCheck(socket);
        if (!passed) {
          throw new Error('Custom authorization check failed');
        }
      }

      // Allow joining room
      socket.join(roomName);
      console.log(`✅ User ${user?.username || 'anonymous'} joined room: ${roomName}`);

      // Call callback if provided
      if (callback) {
        callback();
      }
    } catch (error) {
      console.error(`❌ Room join failed for ${roomName}:`, error);

      // Call callback with error if provided
      if (callback) {
        callback(error instanceof Error ? error : new Error('Room join failed'));
      } else {
        // Emit error event if no callback
        socket.emit('room:error', {
          room: roomName,
          message: error instanceof Error ? error.message : 'Room join failed'
        });
      }
    }
  };
}

/**
 * Middleware for event-level authorization
 * Protects specific socket events with role-based access control
 *
 * @param requiredRoles Roles required to execute the event
 * @param handler Event handler function
 * @returns Wrapped event handler with authorization check
 *
 * Usage:
 * ```typescript
 * socket.on('admin:action',
 *   eventAuthMiddleware(['admin'], async (data) => {
 *     // Admin-only action
 *   })
 * );
 * ```
 */
export function eventAuthMiddleware<T = any>(
  requiredRoles: string[],
  handler: (socket: Socket, data: T, callback?: Function) => void | Promise<void>
) {
  return async (socket: Socket, data: T, callback?: Function): Promise<void> => {
    try {
      // Check if user has required roles
      if (!hasAnyRole(socket, requiredRoles)) {
        throw new Error('Insufficient permissions for this action');
      }

      // Execute handler
      await handler(socket, data, callback);
    } catch (error) {
      console.error('❌ Event authorization failed:', error);

      // Call callback with error if provided
      if (callback && typeof callback === 'function') {
        callback({
          success: false,
          error: error instanceof Error ? error.message : 'Authorization failed'
        });
      } else {
        // Emit error event if no callback
        socket.emit('event:error', {
          message: error instanceof Error ? error.message : 'Authorization failed'
        });
      }
    }
  };
}

/**
 * Middleware to require email verification
 * Can be used as a namespace or event middleware
 *
 * Usage:
 * ```typescript
 * socket.use(requireVerifiedMiddleware);
 * ```
 */
export const requireVerifiedMiddleware = (
  socket: Socket,
  next: (err?: ExtendedError) => void
): void => {
  const user = getSocketUser(socket);

  if (!user) {
    const error = new Error('Authentication required') as ExtendedError;
    error.data = { code: 'AUTH_REQUIRED' };
    next(error);
    return;
  }

  if (!user.isVerified) {
    const error = new Error('Email verification required') as ExtendedError;
    error.data = { code: 'VERIFICATION_REQUIRED' };
    next(error);
    return;
  }

  next();
};

/**
 * Middleware to require specific role
 * Factory function that creates role-checking middleware
 *
 * @param role Required role
 * @returns Socket.IO middleware function
 *
 * Usage:
 * ```typescript
 * const adminNamespace = io.of('/admin');
 * adminNamespace.use(requireRoleMiddleware('admin'));
 * ```
 */
export function requireRoleMiddleware(role: string) {
  return (socket: Socket, next: (err?: ExtendedError) => void): void => {
    if (!hasRole(socket, role)) {
      const error = new Error(`Role '${role}' required`) as ExtendedError;
      error.data = { code: 'INSUFFICIENT_PERMISSIONS', requiredRole: role };
      next(error);
      return;
    }

    next();
  };
}

/**
 * Middleware to require any of the specified roles
 *
 * @param roles Array of acceptable roles
 * @returns Socket.IO middleware function
 */
export function requireAnyRoleMiddleware(roles: string[]) {
  return (socket: Socket, next: (err?: ExtendedError) => void): void => {
    if (!hasAnyRole(socket, roles)) {
      const error = new Error(`One of these roles required: ${roles.join(', ')}`) as ExtendedError;
      error.data = { code: 'INSUFFICIENT_PERMISSIONS', requiredRoles: roles };
      next(error);
      return;
    }

    next();
  };
}

/**
 * Middleware to require all specified roles
 *
 * @param roles Array of required roles
 * @returns Socket.IO middleware function
 */
export function requireAllRolesMiddleware(roles: string[]) {
  return (socket: Socket, next: (err?: ExtendedError) => void): void => {
    if (!hasAllRoles(socket, roles)) {
      const error = new Error(`All these roles required: ${roles.join(', ')}`) as ExtendedError;
      error.data = { code: 'INSUFFICIENT_PERMISSIONS', requiredRoles: roles };
      next(error);
      return;
    }

    next();
  };
}

/**
 * Rate limiting middleware for socket events
 * Prevents abuse by limiting event frequency per user
 *
 * @param maxEvents Maximum events allowed
 * @param windowMs Time window in milliseconds
 * @returns Socket.IO middleware function
 *
 * Usage:
 * ```typescript
 * socket.use(rateLimitMiddleware(10, 1000)); // 10 events per second
 * ```
 */
export function rateLimitMiddleware(maxEvents: number, windowMs: number) {
  const eventCounts = new Map<string, { count: number; resetAt: number }>();

  return (socket: Socket, next: (err?: ExtendedError) => void): void => {
    const user = getSocketUser(socket);
    const userId = user?.userId || socket.id;

    const now = Date.now();
    const userLimit = eventCounts.get(userId);

    if (!userLimit || now > userLimit.resetAt) {
      // Start new window
      eventCounts.set(userId, {
        count: 1,
        resetAt: now + windowMs
      });
      next();
      return;
    }

    if (userLimit.count >= maxEvents) {
      const error = new Error('Rate limit exceeded') as ExtendedError;
      error.data = {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userLimit.resetAt - now) / 1000)
      };
      next(error);
      return;
    }

    // Increment count
    userLimit.count++;
    next();
  };
}
