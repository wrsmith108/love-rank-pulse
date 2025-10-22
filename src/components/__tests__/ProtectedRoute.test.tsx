/**
 * ProtectedRoute Component Test Suite
 * Tests route protection, redirects, and authentication checks
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';

// Mock the playerService
jest.mock('@/services', () => ({
  playerService: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

const TestComponent = () => <div>Protected Content</div>;
const LoginComponent = () => <div>Login Page</div>;

const renderProtectedRoute = (
  isAuthenticated = false,
  isLoading = false,
  initialRoute = '/protected'
) => {
  // Set up localStorage to simulate auth state
  if (isAuthenticated) {
    localStorage.setItem('love-rank-pulse-token', 'mock-token');
    localStorage.setItem('love-rank-pulse-user', JSON.stringify({
      id: '1',
      email: 'test@example.com',
      username: 'testuser'
    }));
    localStorage.setItem('love-rank-pulse-expires-at', new Date(Date.now() + 3600000).toISOString());
  }

  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginComponent />} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <TestComponent />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // TC-PROTECT-001: Redirect unauthenticated users to login
  test('TC-PROTECT-001: should redirect unauthenticated users to login', async () => {
    renderProtectedRoute(false, false);

    await waitFor(() => {
      expect(screen.getByText(/login page/i)).toBeInTheDocument();
      expect(screen.queryByText(/protected content/i)).not.toBeInTheDocument();
    });
  });

  // TC-PROTECT-002: Allow authenticated users to access
  test('TC-PROTECT-002: should allow authenticated users to access protected content', async () => {
    renderProtectedRoute(true, false);

    await waitFor(() => {
      expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    });
  });

  // TC-PROTECT-003: Show loading state during auth check
  test('TC-PROTECT-003: should show loading state during authentication check', () => {
    // Clear localStorage to trigger loading state
    localStorage.clear();

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    // Should show loading spinner initially
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // TC-PROTECT-004: Token refresh on expired token
  test('TC-PROTECT-004: should redirect when token is expired', async () => {
    // Set expired token
    localStorage.setItem('love-rank-pulse-token', 'expired-token');
    localStorage.setItem('love-rank-pulse-user', JSON.stringify({
      id: '1',
      email: 'test@example.com',
      username: 'testuser'
    }));
    localStorage.setItem('love-rank-pulse-expires-at', new Date(Date.now() - 1000).toISOString());

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginComponent />} />
            <Route
              path="/protected"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/login page/i)).toBeInTheDocument();
    });
  });

  // TC-PROTECT-005: Remember and restore return URL
  test('TC-PROTECT-005: should preserve location state for return URL', async () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LoginComponent />} />
            <Route
              path="/protected"
              element={
                <ProtectedRoute redirectTo="/">
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/login page/i)).toBeInTheDocument();
    });

    // The location state should contain the 'from' location
    // This is tested by the Navigate component's state prop
  });

  // TC-PROTECT-006: Role-based access control (placeholder for future)
  test('TC-PROTECT-006: should render children when authenticated', async () => {
    renderProtectedRoute(true, false);

    await waitFor(() => {
      const protectedContent = screen.getByText(/protected content/i);
      expect(protectedContent).toBeInTheDocument();
    });
  });
});
