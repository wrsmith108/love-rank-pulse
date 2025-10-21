/**
 * Authentication-related models for the Love Rank Pulse system
 */

/**
 * Authentication user model with credentials
 */
export interface AuthUser {
  // Core identifiers
  id: string;
  username: string;
  email: string;
  
  // Authentication
  password: string; // This would be hashed in a real implementation
  
  // Session management
  lastLoginAt: Date;
  isActive: boolean;
}

/**
 * Authentication token model
 */
export interface AuthToken {
  token: string;
  expiresAt: Date;
  userId: string;
}

/**
 * Registration data for creating a new user
 */
export interface RegistrationData {
  username: string;
  email: string;
  password: string;
  countryCode: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Authentication response after successful login/registration
 */
export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string;
    displayName: string;
    countryCode: string;
  };
  token: string;
  expiresAt: Date;
}