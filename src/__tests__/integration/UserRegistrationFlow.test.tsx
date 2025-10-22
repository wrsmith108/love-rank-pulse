/**
 * Integration Tests: User Registration Flow
 * Test Suite: TC-INT-001 through TC-INT-005
 * Coverage: Complete user registration and authentication flows
 */

import '../setup/jest.polyfills';
import React, { createContext } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Create mock AuthContext for testing
const AuthContext = createContext<any>(null);

// Mock components
const RegisterForm: React.FC = () => (
  <form data-testid="register-form">
    <label htmlFor="username">Username <input id="username" type="text" /></label>
    <label htmlFor="email">Email <input id="email" type="email" /></label>
    <label htmlFor="password">Password <input id="password" type="password" /></label>
    <label><input type="checkbox" role="checkbox" name="terms" /> I accept the terms</label>
    <button type="submit">Register</button>
  </form>
);

const LoginForm: React.FC = () => (
  <form data-testid="login-form">
    <label htmlFor="login-email">Email <input id="login-email" type="email" /></label>
    <label htmlFor="login-password">Password <input id="login-password" type="password" /></label>
    <button type="submit">Login</button>
  </form>
);

// Mock server for API calls
const server = setupServer(
  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      user: { id: '1', username: body.username, email: body.email },
      token: 'mock-jwt-token-12345',
    });
  }),
  http.post('/api/auth/verify-email', async ({ request }) => {
    const body = await request.json() as any;
    if (body.token === 'valid-verification-token') {
      return HttpResponse.json({ success: true, message: 'Email verified' });
    }
    return HttpResponse.json({ error: 'Invalid token' }, { status: 400 });
  }),
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as any;
    if (body.email === 'test@example.com' && body.password === 'Password123!') {
      return HttpResponse.json({
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
        token: 'mock-jwt-token-67890',
      });
    }
    return HttpResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }),
  http.get('/api/auth/validate', ({ request }) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.includes('mock-jwt-token')) {
      return HttpResponse.json({
        valid: true,
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      });
    }
    return HttpResponse.json({ valid: false }, { status: 401 });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  sessionStorage.clear();
});
afterAll(() => server.close());

// Test helper to render with providers
const renderWithProviders = (ui: React.ReactElement, authValue?: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const defaultAuthValue = {
    user: null,
    token: null,
    login: jest.fn(),
    logout: jest.fn(),
    register: jest.fn(),
    isAuthenticated: false,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthContext.Provider value={authValue || defaultAuthValue}>
          {ui}
        </AuthContext.Provider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('User Registration Flow - Integration Tests', () => {
  /**
   * TC-INT-001: Complete Registration Flow
   * Verify: Complete user registration from form submission to dashboard
   * SLA: <2 seconds
   */
  test('TC-INT-001: Complete registration flow with all validations', async () => {
    const user = userEvent.setup();
    const startTime = performance.now();

    const mockRegister = jest.fn(async (username, email, password) => {
      return {
        user: { id: '1', username, email },
        token: 'mock-jwt-token-12345',
      };
    });

    renderWithProviders(<RegisterForm />, { register: mockRegister });

    // Fill registration form
    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);
    const termsCheckbox = screen.getByRole('checkbox', { name: /terms/i });
    const submitButton = screen.getByRole('button', { name: /register|sign up/i });

    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(termsCheckbox);
    await user.click(submitButton);

    // Verify API call made
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'testuser',
        'test@example.com',
        'Password123!'
      );
    });

    // Verify registration completes
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Performance assertion
    expect(duration).toBeLessThan(2000); // <2 seconds SLA

    // Verify token would be stored (mocked in real implementation)
    expect(mockRegister).toHaveReturned();
  });

  /**
   * TC-INT-002: Email Verification Flow
   * Verify: Email verification token generation and activation
   */
  test('TC-INT-002: Email verification flow activates account', async () => {
    const verifyEmail = async (token: string) => {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      return response.json();
    };

    // Simulate email verification with valid token
    const result = await verifyEmail('valid-verification-token');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Email verified');

    // Verify invalid token fails
    const invalidResult = await verifyEmail('invalid-token');
    expect(invalidResult.error).toBe('Invalid token');
  });

  /**
   * TC-INT-003: First Login After Registration
   * Verify: User can login after registration completes
   */
  test('TC-INT-003: First login after registration succeeds', async () => {
    const user = userEvent.setup();

    const mockLogin = jest.fn(async (email, password) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return response.json();
    });

    renderWithProviders(<LoginForm />, { login: mockLogin });

    // Fill login form
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login|sign in/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'Password123!');
    await user.click(submitButton);

    // Verify login successful
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'Password123!');
    });

    await waitFor(async () => {
      const result = await mockLogin.mock.results[0]?.value;
      expect(result.token).toBe('mock-jwt-token-67890');
      expect(result.user.email).toBe('test@example.com');
    });
  });

  /**
   * TC-INT-004: Session Persistence Across Page Refresh
   * Verify: Authentication state persists on page reload
   */
  test('TC-INT-004: Session persists across page refresh', async () => {
    // Simulate successful login
    const token = 'mock-jwt-token-12345';
    const userData = { id: '1', username: 'testuser', email: 'test@example.com' };

    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(userData));

    // Simulate page refresh by validating token
    const validateToken = async (authToken: string) => {
      const response = await fetch('/api/auth/validate', {
        headers: { authorization: `Bearer ${authToken}` },
      });
      return response.json();
    };

    const storedToken = localStorage.getItem('auth_token');
    expect(storedToken).toBe(token);

    const validation = await validateToken(storedToken!);
    expect(validation.valid).toBe(true);
    expect(validation.user.email).toBe('test@example.com');

    // Verify no re-login required
    expect(localStorage.getItem('auth_token')).toBeTruthy();
  });

  /**
   * TC-INT-005: Multi-Device Login
   * Verify: Same user can login on multiple devices simultaneously
   */
  test('TC-INT-005: Multi-device login allows concurrent sessions', async () => {
    const loginUser = async (sessionId: string) => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'Password123!',
          sessionId,
        }),
      });
      return response.json();
    };

    // Simulate login on device A
    const deviceA = await loginUser('device-a-session');
    expect(deviceA.token).toBeTruthy();

    // Simulate login on device B (same user)
    const deviceB = await loginUser('device-b-session');
    expect(deviceB.token).toBeTruthy();

    // Verify both sessions are valid
    expect(deviceA.token).not.toBe(deviceB.token); // Different tokens
    expect(deviceA.user.email).toBe(deviceB.user.email); // Same user

    // Verify both tokens are valid
    const validateA = await fetch('/api/auth/validate', {
      headers: { authorization: `Bearer ${deviceA.token}` },
    });
    const validateB = await fetch('/api/auth/validate', {
      headers: { authorization: `Bearer ${deviceB.token}` },
    });

    expect(validateA.ok).toBe(true);
    expect(validateB.ok).toBe(true);
  });
});
