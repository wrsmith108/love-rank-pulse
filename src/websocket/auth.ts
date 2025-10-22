import { Socket } from 'socket.io';
import { playerService } from '../services/PlayerService';

/**
 * Authenticated user data attached to socket
 */
export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
  isVerified: boolean;
  roles?: string[];
}

/**
 * Extended socket with authentication data
 */
export interface AuthenticatedSocket extends Socket {
  data: {
    user?: AuthenticatedUser;
    authenticated: boolean;
  };
}

/**
 * Extract JWT token from socket handshake
 * Supports both query parameters (?token=xxx) and Authorization header
 *
 * @param socket Socket.IO socket instance
 * @returns JWT token string or null if not found
 */
export function extractToken(socket: Socket): string | null {
  // Try query parameter first (?token=xxx)
  const queryToken = socket.handshake.query.token;
  if (queryToken && typeof queryToken === 'string') {
    return queryToken;
  }

  // Try Authorization header (Bearer token)
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && typeof authHeader === 'string') {
    // Extract token from "Bearer <token>" format
    const matches = authHeader.match(/^Bearer\s+(.+)$/i);
    if (matches && matches[1]) {
      return matches[1];
    }
    // Also support plain token without "Bearer" prefix
    return authHeader;
  }

  // Try auth object (for some socket.io clients)
  const authToken = socket.handshake.auth?.token;
  if (authToken && typeof authToken === 'string') {
    return authToken;
  }

  return null;
}

/**
 * Verify JWT token and attach user data to socket
 * This is the main authentication middleware for WebSocket connections
 *
 * @param socket Socket.IO socket instance
 * @returns Promise that resolves with authenticated user or rejects with error
 */
export async function verifySocketToken(socket: Socket): Promise<AuthenticatedUser> {
  // Extract token from handshake
  const token = extractToken(socket);

  if (!token) {
    throw new Error('Authentication token not provided');
  }

  // Validate token using PlayerService
  const validation = await playerService.validateToken(token);

  if (!validation.valid || !validation.userId || !validation.username || !validation.email) {
    throw new Error(validation.error || 'Invalid authentication token');
  }

  // Get full player data to check verification status
  const player = await playerService.getPlayerById(validation.userId);

  if (!player) {
    throw new Error('User not found');
  }

  if (!player.isActive) {
    throw new Error('Account is deactivated');
  }

  // Create authenticated user object
  const authenticatedUser: AuthenticatedUser = {
    userId: validation.userId,
    username: validation.username,
    email: validation.email,
    isVerified: player.isVerified,
    roles: [] // Can be extended with role-based access control
  };

  return authenticatedUser;
}

/**
 * Attach authenticated user to socket instance
 *
 * @param socket Socket.IO socket instance
 * @param user Authenticated user data
 */
export function attachUserToSocket(socket: AuthenticatedSocket, user: AuthenticatedUser): void {
  socket.data = {
    user: user,
    authenticated: true
  };
}

/**
 * Check if socket is authenticated
 *
 * @param socket Socket.IO socket instance
 * @returns True if socket has valid authentication
 */
export function isSocketAuthenticated(socket: Socket): socket is AuthenticatedSocket {
  const authSocket = socket as AuthenticatedSocket;
  return authSocket.data?.authenticated === true && authSocket.data?.user !== undefined;
}

/**
 * Get authenticated user from socket
 *
 * @param socket Socket.IO socket instance
 * @returns Authenticated user data or null if not authenticated
 */
export function getSocketUser(socket: Socket): AuthenticatedUser | null {
  if (!isSocketAuthenticated(socket)) {
    return null;
  }
  return socket.data.user || null;
}

/**
 * Disconnect socket with error message
 *
 * @param socket Socket.IO socket instance
 * @param error Error message
 */
export function disconnectWithError(socket: Socket, error: string): void {
  socket.emit('error', {
    message: error,
    code: 'AUTH_FAILED'
  });
  socket.disconnect(true);
}

/**
 * Handle token refresh for WebSocket connections
 * Allows clients to update their token without reconnecting
 *
 * @param socket Socket.IO socket instance
 * @param newToken New JWT token
 * @returns Promise that resolves when token is refreshed
 */
export async function refreshSocketToken(socket: AuthenticatedSocket, newToken: string): Promise<void> {
  try {
    // Validate new token
    const validation = await playerService.validateToken(newToken);

    if (!validation.valid || !validation.userId || !validation.username || !validation.email) {
      throw new Error(validation.error || 'Invalid token');
    }

    // Get player data
    const player = await playerService.getPlayerById(validation.userId);

    if (!player || !player.isActive) {
      throw new Error('Invalid user');
    }

    // Update socket user data
    const updatedUser: AuthenticatedUser = {
      userId: validation.userId,
      username: validation.username,
      email: validation.email,
      isVerified: player.isVerified,
      roles: socket.data.user?.roles || []
    };

    attachUserToSocket(socket, updatedUser);

    // Emit success event
    socket.emit('token:refreshed', {
      success: true,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    // Emit error event but don't disconnect
    socket.emit('token:refresh:error', {
      success: false,
      message: error instanceof Error ? error.message : 'Token refresh failed'
    });
    throw error;
  }
}

/**
 * Check if user has required role
 * Useful for role-based access control
 *
 * @param socket Socket.IO socket instance
 * @param requiredRole Role to check
 * @returns True if user has the required role
 */
export function hasRole(socket: Socket, requiredRole: string): boolean {
  const user = getSocketUser(socket);
  if (!user || !user.roles) {
    return false;
  }
  return user.roles.includes(requiredRole);
}

/**
 * Check if user has any of the required roles
 *
 * @param socket Socket.IO socket instance
 * @param requiredRoles Array of roles to check
 * @returns True if user has at least one of the required roles
 */
export function hasAnyRole(socket: Socket, requiredRoles: string[]): boolean {
  const user = getSocketUser(socket);
  if (!user || !user.roles) {
    return false;
  }
  return requiredRoles.some(role => user.roles!.includes(role));
}

/**
 * Check if user has all required roles
 *
 * @param socket Socket.IO socket instance
 * @param requiredRoles Array of roles to check
 * @returns True if user has all required roles
 */
export function hasAllRoles(socket: Socket, requiredRoles: string[]): boolean {
  const user = getSocketUser(socket);
  if (!user || !user.roles) {
    return false;
  }
  return requiredRoles.every(role => user.roles!.includes(role));
}
