import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Player } from '@/models';

// Re-create the AuthContext type based on the implementation
interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: Player | null;
  isLoading: boolean;
  error: string | null;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Create a mock context for testing
const AuthContext = React.createContext<AuthContextType>({
  isAuthenticated: false,
  currentUser: null,
  isLoading: false,
  error: null,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  clearError: () => {},
});

/**
 * Custom render function that wraps components with necessary providers
 * @param ui Component to render
 * @param options Render options
 * @param authContextValue Auth context value
 * @returns Rendered component
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
  authContextValue?: Partial<AuthContextType>
) {
  // Default auth context
  const defaultAuthContext: AuthContextType = {
    isAuthenticated: false,
    currentUser: null,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
    error: null,
    clearError: jest.fn(),
    ...authContextValue
  };

  // Wrapper component with all providers
  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <AuthContext.Provider value={defaultAuthContext}>
          {children}
        </AuthContext.Provider>
      </BrowserRouter>
    );
  }

  return render(ui, { wrapper: AllTheProviders, ...options });
}

/**
 * Create a mock authenticated user
 * @returns Mock authenticated user
 */
export function createMockAuthUser(): Player {
  return {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
    countryCode: 'US',
    createdAt: new Date(),
    lastLoginAt: new Date(),
    isActive: true
  };
}

/**
 * Create a mock authenticated context
 * @param user Optional user to include in the context
 * @returns Mock authenticated context
 */
export function createMockAuthContext(user?: Player): AuthContextType {
  return {
    isAuthenticated: true,
    currentUser: user || createMockAuthUser(),
    login: jest.fn().mockResolvedValue({}),
    register: jest.fn().mockResolvedValue({}),
    logout: jest.fn().mockResolvedValue(true),
    isLoading: false,
    error: null,
    clearError: jest.fn()
  };
}

/**
 * Create a mock unauthenticated context
 * @returns Mock unauthenticated context
 */
export function createMockUnauthContext(): AuthContextType {
  return {
    isAuthenticated: false,
    currentUser: null,
    login: jest.fn().mockRejectedValue(new Error('Invalid credentials')),
    register: jest.fn().mockRejectedValue(new Error('Registration failed')),
    logout: jest.fn().mockResolvedValue(true),
    isLoading: false,
    error: 'Not authenticated',
    clearError: jest.fn()
  };
}

/**
 * Create a mock loading context
 * @returns Mock loading context
 */
export function createMockLoadingContext(): AuthContextType {
  return {
    isAuthenticated: false,
    currentUser: null,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    isLoading: true,
    error: null,
    clearError: jest.fn()
  };
}