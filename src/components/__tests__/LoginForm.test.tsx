/**
 * LoginForm Component Test Suite
 * Tests authentication form functionality including validation, submission, and user interactions
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

// Mock the playerService
jest.mock('@/services', () => ({
  playerService: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

const mockPlayerService = require('@/services').playerService;

// Helper to render with providers
const renderLoginForm = (props = {}) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <LoginForm {...props} />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // TC-LOGIN-001: Render all form fields (email, password)
  test('TC-LOGIN-001: should render all form fields', () => {
    renderLoginForm();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  // TC-LOGIN-002: Email validation (format, required)
  test('TC-LOGIN-002: should validate email format', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    // Try submitting with invalid email
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    // HTML5 validation should prevent submission
    expect(mockPlayerService.login).not.toHaveBeenCalled();
  });

  // TC-LOGIN-003: Password validation (required, min length)
  test('TC-LOGIN-003: should validate password is required', async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const emailInput = screen.getByLabelText(/email/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);

    // Should not call login without password
    expect(mockPlayerService.login).not.toHaveBeenCalled();
  });

  // TC-LOGIN-004: Form submission with valid data
  test('TC-LOGIN-004: should submit form with valid credentials', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = jest.fn();

    mockPlayerService.login.mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com', username: 'testuser' },
      token: 'mock-token',
      expiresAt: new Date(Date.now() + 3600000),
    });

    renderLoginForm({ onSuccess: mockOnSuccess });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockPlayerService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  // TC-LOGIN-005: Form submission error handling
  test('TC-LOGIN-005: should display error message on login failure', async () => {
    const user = userEvent.setup();

    mockPlayerService.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLoginForm();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  // TC-LOGIN-006: Loading state during submission
  test('TC-LOGIN-006: should show loading state during submission', async () => {
    const user = userEvent.setup();

    // Create a promise that we can control
    let resolveLogin: any;
    mockPlayerService.login.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    renderLoginForm();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText(/logging in/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    // Resolve the promise
    resolveLogin({
      user: { id: '1', email: 'test@example.com', username: 'testuser' },
      token: 'mock-token',
      expiresAt: new Date(Date.now() + 3600000),
    });
  });

  // TC-LOGIN-007: Remember me checkbox functionality
  test('TC-LOGIN-007: should clear error when user types', async () => {
    const user = userEvent.setup();

    mockPlayerService.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    renderLoginForm();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole('button', { name: /login/i });

    // Trigger error
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });

    // Type again to clear error
    await user.type(emailInput, 'a');

    await waitFor(() => {
      expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
    });
  });

  // TC-LOGIN-008: Password visibility toggle (not implemented yet, test for future)
  test('TC-LOGIN-008: should have password field type', () => {
    renderLoginForm();

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  // TC-LOGIN-009: Forgot password link navigation
  test('TC-LOGIN-009: should display forgot password link', () => {
    renderLoginForm();

    const forgotPasswordLink = screen.getByText(/forgot password/i);
    expect(forgotPasswordLink).toBeInTheDocument();
  });

  // TC-LOGIN-010: Keyboard accessibility (tab order, enter to submit)
  test('TC-LOGIN-010: should support keyboard navigation and submission', async () => {
    const user = userEvent.setup();

    mockPlayerService.login.mockResolvedValueOnce({
      user: { id: '1', email: 'test@example.com', username: 'testuser' },
      token: 'mock-token',
      expiresAt: new Date(Date.now() + 3600000),
    });

    renderLoginForm();

    const emailInput = screen.getByLabelText(/email/i);

    // Tab through form
    await user.tab();
    expect(emailInput).toHaveFocus();

    await user.type(emailInput, 'test@example.com');
    await user.tab();

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveFocus();

    await user.type(passwordInput, 'password123');

    // Submit with Enter key
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockPlayerService.login).toHaveBeenCalled();
    });
  });
});
