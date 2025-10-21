import { RequestContext } from '../ApiGateway';
import { playerService } from '../../services';

/**
 * Authentication Middleware
 * 
 * Handles authentication and authorization for API requests.
 */

/**
 * Extract and validate authentication token from request headers
 * @param headers Request headers containing the authorization token
 * @returns User ID if authenticated, undefined otherwise
 */
export function extractAuthToken(headers: Record<string, string>): string | undefined {
  const authHeader = headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // In a real implementation, this would validate the token against a database or JWT
  // For our mock implementation, we'll use the playerService to validate
  
  // Get all tokens from localStorage (in a real app, this would be from a database)
  const storedToken = localStorage.getItem('love-rank-pulse-token');
  const storedUser = localStorage.getItem('love-rank-pulse-user');
  
  if (!storedToken || !storedUser) {
    return undefined;
  }
  
  // Check if token matches
  if (storedToken !== token) {
    return undefined;
  }
  
  // Parse user and return ID
  try {
    const user = JSON.parse(storedUser);
    return user.id;
  } catch (error) {
    console.error('Error parsing stored user:', error);
    return undefined;
  }
}

/**
 * Authenticate a request
 * @param context Request context to authenticate
 * @param headers Request headers containing the authorization token
 * @returns Updated request context with authentication information
 */
export function authenticateRequest(
  context: RequestContext,
  headers: Record<string, string>
): RequestContext {
  const userId = extractAuthToken(headers);
  
  if (!userId) {
    return {
      ...context,
      isAuthenticated: false
    };
  }
  
  // In a real implementation, we would validate the token's expiration
  // For our mock implementation, we'll assume it's valid if it exists
  
  return {
    ...context,
    userId,
    isAuthenticated: true,
    token: headers['authorization']?.substring(7) // Remove 'Bearer ' prefix
  };
}

/**
 * Check if a user has permission for a specific action
 * @param userId User ID to check
 * @param resource Resource being accessed
 * @param action Action being performed
 * @returns True if authorized, false otherwise
 */
export function checkPermission(
  userId: string,
  resource: string,
  action: 'read' | 'write' | 'delete'
): boolean {
  // In a real implementation, this would check against a permissions database
  // For our mock implementation, we'll use simple rules:
  
  // 1. Users can always access their own resources
  if (resource.includes(`/players/${userId}`)) {
    return true;
  }
  
  // 2. Public resources are accessible to all authenticated users
  if (
    resource.startsWith('/leaderboards') ||
    resource.startsWith('/matches') ||
    (resource.startsWith('/players') && action === 'read')
  ) {
    return true;
  }
  
  // 3. Admin users can access everything
  // In a real app, we would check if the user is an admin
  // For now, we'll assume no admin privileges
  
  return false;
}

/**
 * Create middleware to require authentication for protected routes
 * @param requireAuth Whether authentication is required
 * @returns Middleware function
 */
export function requireAuth(requireAuth: boolean = true) {
  return (context: RequestContext): RequestContext | Error => {
    if (requireAuth && !context.isAuthenticated) {
      throw new Error('Authentication required');
    }
    
    return context;
  };
}

/**
 * Create middleware to require specific permissions
 * @param resource Resource being accessed
 * @param action Action being performed
 * @returns Middleware function
 */
export function requirePermission(
  resource: string,
  action: 'read' | 'write' | 'delete'
) {
  return (context: RequestContext): RequestContext | Error => {
    if (!context.isAuthenticated || !context.userId) {
      throw new Error('Authentication required');
    }
    
    const hasPermission = checkPermission(context.userId, resource, action);
    
    if (!hasPermission) {
      throw new Error('Permission denied');
    }
    
    return context;
  };
}