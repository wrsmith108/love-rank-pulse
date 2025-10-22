/**
 * useAuth Hook - Authentication State Management
 *
 * Features:
 * - Current user state management
 * - Login/logout functionality
 * - Token persistence
 * - Authentication status
 * - User profile management
 *
 * @module hooks/useAuth
 */

import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { apiClient, tokenManager, handleApiError, ApiError } from '@/utils/apiClient';

/**
 * User data structure
 */
export interface User {
  user_id: string;
  player_id: string;
  email: string;
  username: string;
  player_name: string;
  country_code: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  username: string;
  player_name: string;
  country_code: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

/**
 * Fetch current user from API
 */
const fetchCurrentUser = async (): Promise<User | null> => {
  if (!tokenManager.isAuthenticated()) {
    return null;
  }

  try {
    const response = await apiClient.get<{ user: User }>('/auth/me');
    return response.data.user;
  } catch (error) {
    // If auth fails, clear tokens
    tokenManager.clearTokens();
    throw handleApiError(error);
  }
};

/**
 * Login user
 */
const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    const { token, refreshToken, user } = response.data;

    // Store tokens
    tokenManager.setToken(token);
    tokenManager.setRefreshToken(refreshToken);

    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Register new user
 */
const registerUser = async (data: RegisterData): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    const { token, refreshToken } = response.data;

    // Store tokens
    tokenManager.setToken(token);
    tokenManager.setRefreshToken(refreshToken);

    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * Logout user
 */
const logoutUser = async (): Promise<void> => {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    // Ignore errors during logout
    console.error('Logout error:', error);
  } finally {
    // Always clear tokens locally
    tokenManager.clearTokens();
  }
};

/**
 * useAuth Hook
 *
 * @returns Authentication state and methods
 *
 * @example
 * ```tsx
 * const { user, isLoading, isAuthenticated, login, logout, register } = useAuth();
 *
 * // Login
 * await login({ email: 'user@example.com', password: 'password' });
 *
 * // Logout
 * await logout();
 *
 * // Register
 * await register({
 *   email: 'user@example.com',
 *   password: 'password',
 *   username: 'player123',
 *   player_name: 'Player Name',
 *   country_code: 'US'
 * });
 * ```
 */
export const useAuth = () => {
  const queryClient = useQueryClient();

  // Fetch current user
  const userQuery: UseQueryResult<User | null, ApiError> = useQuery<User | null, ApiError>({
    queryKey: ['currentUser'],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: false,
  });

  // Login mutation
  const loginMutation = useMutation<AuthResponse, ApiError, LoginCredentials>({
    mutationFn: loginUser,
    onSuccess: (data) => {
      // Update user in cache
      queryClient.setQueryData(['currentUser'], data.user);
    },
  });

  // Register mutation
  const registerMutation = useMutation<AuthResponse, ApiError, RegisterData>({
    mutationFn: registerUser,
    onSuccess: (data) => {
      // Update user in cache
      queryClient.setQueryData(['currentUser'], data.user);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation<void, ApiError, void>({
    mutationFn: logoutUser,
    onSuccess: () => {
      // Clear user from cache
      queryClient.setQueryData(['currentUser'], null);
      queryClient.clear();
    },
  });

  return {
    // User state
    user: userQuery.data,
    isLoading: userQuery.isLoading,
    isError: userQuery.isError,
    error: userQuery.error,
    isAuthenticated: !!userQuery.data && tokenManager.isAuthenticated(),

    // Auth methods
    login: loginMutation.mutateAsync,
    loginStatus: {
      isLoading: loginMutation.isPending,
      isError: loginMutation.isError,
      error: loginMutation.error,
    },

    register: registerMutation.mutateAsync,
    registerStatus: {
      isLoading: registerMutation.isPending,
      isError: registerMutation.isError,
      error: registerMutation.error,
    },

    logout: logoutMutation.mutateAsync,
    logoutStatus: {
      isLoading: logoutMutation.isPending,
      isError: logoutMutation.isError,
      error: logoutMutation.error,
    },

    // Utility methods
    refetchUser: userQuery.refetch,
  };
};

export default useAuth;
