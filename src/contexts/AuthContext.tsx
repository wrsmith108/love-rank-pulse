import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { playerService } from '@/services';
import { Player, AuthResponse, LoginCredentials, RegistrationData } from '@/models';

// Define the shape of our authentication context
interface AuthContextType {
  // State
  isAuthenticated: boolean;
  currentUser: Player | null;
  isLoading: boolean;
  error: string | null;
  
  // Methods
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegistrationData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  isLoading: false,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  clearError: () => {},
});

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Props for the AuthProvider component
interface AuthProviderProps {
  children: ReactNode;
}

// Local storage keys
const TOKEN_KEY = 'love-rank-pulse-token';
const USER_KEY = 'love-rank-pulse-user';
const EXPIRES_AT_KEY = 'love-rank-pulse-expires-at';

/**
 * AuthProvider component to wrap the application and provide authentication state
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from local storage
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const userJson = localStorage.getItem(USER_KEY);
        const expiresAtStr = localStorage.getItem(EXPIRES_AT_KEY);
        
        if (!token || !userJson || !expiresAtStr) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setIsLoading(false);
          return;
        }
        
        // Check if token is expired
        const expiresAt = new Date(expiresAtStr);
        if (expiresAt < new Date()) {
          // Token expired, clear storage
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          localStorage.removeItem(EXPIRES_AT_KEY);
          setIsAuthenticated(false);
          setCurrentUser(null);
          setIsLoading(false);
          return;
        }
        
        // Token is valid
        const user = JSON.parse(userJson);
        setIsAuthenticated(true);
        setCurrentUser(user);
      } catch (err) {
        console.error('Error initializing auth:', err);
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeAuth();
  }, []);

  /**
   * Save authentication data to local storage
   */
  const saveAuthData = (authResponse: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, authResponse.token);
    localStorage.setItem(USER_KEY, JSON.stringify(authResponse.user));
    localStorage.setItem(EXPIRES_AT_KEY, authResponse.expiresAt.toISOString());
  };

  /**
   * Clear authentication data from local storage
   */
  const clearAuthData = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
  };

  /**
   * Login a user
   */
  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const authResponse = playerService.login(credentials);
      saveAuthData(authResponse);
      setIsAuthenticated(true);
      setCurrentUser(playerService.getCurrentUser());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register a new user
   */
  const register = async (data: RegistrationData) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const authResponse = playerService.register(data);
      saveAuthData(authResponse);
      setIsAuthenticated(true);
      setCurrentUser(playerService.getCurrentUser());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout the current user
   */
  const logout = async () => {
    setIsLoading(true);
    
    try {
      playerService.logout();
      clearAuthData();
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear any authentication errors
   */
  const clearError = () => {
    setError(null);
  };

  // Create the context value object
  const contextValue: AuthContextType = {
    isAuthenticated,
    currentUser,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};