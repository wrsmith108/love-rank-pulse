/**
 * RegisterForm Component Test Suite
 * Tests user registration form including validation, submission, and error handling
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '../RegisterForm';
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
const renderRegisterForm = (props = {}) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <RegisterForm {...props} />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('RegisterForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // TC-REG-001: Render all form fields
  test('TC-REG-001: should render all registration form fields', () => {
    renderRegisterForm();

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  // TC-REG-002: Username validation (unique, alphanumeric)
  test('TC-REG-002: should validate username format', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });

    // Invalid username (too short)
    await user.type(usernameInput, 'ab');
    await user.type(emailInput, 'test@example.com');

    // Open country select and select a country
    const countryTrigger = screen.getByRole('combobox');
    await user.click(countryTrigger);
    const usOption = await screen.findByText('United States');
    await user.click(usOption);

    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/username must be 3-20 characters/i)).toBeInTheDocument();
    });
  });

  // TC-REG-003: Email validation and uniqueness
  test('TC-REG-003: should validate email format', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });

    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'invalid-email');

    // Open country select
    const countryTrigger = screen.getByRole('combobox');
    await user.click(countryTrigger);
    const usOption = await screen.findByText('United States');
    await user.click(usOption);

    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
    });
  });

  // TC-REG-004: Password strength indicator
  test('TC-REG-004: should validate password strength', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });

    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'test@example.com');

    // Open country select
    const countryTrigger = screen.getByRole('combobox');
    await user.click(countryTrigger);
    const usOption = await screen.findByText('United States');
    await user.click(usOption);

    // Weak password (no numbers)
    await user.type(passwordInput, 'password');
    await user.type(confirmPasswordInput, 'password');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters and include at least one letter and one number/i)).toBeInTheDocument();
    });
  });

  // TC-REG-005: Password confirmation match validation
  test('TC-REG-005: should validate password confirmation matches', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });

    await user.type(usernameInput, 'testuser');
    await user.type(emailInput, 'test@example.com');

    // Open country select
    const countryTrigger = screen.getByRole('combobox');
    await user.click(countryTrigger);
    const usOption = await screen.findByText('United States');
    await user.click(usOption);

    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password456');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  // TC-REG-006: Terms and conditions checkbox (not implemented, placeholder)
  test('TC-REG-006: should require all fields', async () => {
    const user = userEvent.setup();
    renderRegisterForm();

    const submitButton = screen.getByRole('button', { name: /register/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/all fields are required/i)).toBeInTheDocument();
    });
  });

  // TC-REG-007: Successful registration flow
  test('TC-REG-007: should successfully register with valid data', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = jest.fn();

    mockPlayerService.register.mockResolvedValueOnce({
      user: {
        id: '1',
        email: 'newuser@example.com',
        username: 'newuser',
        countryCode: 'US'
      },
      token: 'mock-token',
      expiresAt: new Date(Date.now() + 3600000),
    });

    renderRegisterForm({ onSuccess: mockOnSuccess });

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });

    await user.type(usernameInput, 'newuser');
    await user.type(emailInput, 'newuser@example.com');

    // Open country select
    const countryTrigger = screen.getByRole('combobox');
    await user.click(countryTrigger);
    const usOption = await screen.findByText('United States');
    await user.click(usOption);

    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockPlayerService.register).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        countryCode: 'US',
      });
    });
  });

  // TC-REG-008: Duplicate user error handling
  test('TC-REG-008: should display error on duplicate user', async () => {
    const user = userEvent.setup();

    mockPlayerService.register.mockRejectedValueOnce(new Error('User already exists'));

    renderRegisterForm();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });

    await user.type(usernameInput, 'existinguser');
    await user.type(emailInput, 'existing@example.com');

    // Open country select
    const countryTrigger = screen.getByRole('combobox');
    await user.click(countryTrigger);
    const usOption = await screen.findByText('United States');
    await user.click(usOption);

    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/user already exists/i)).toBeInTheDocument();
    });
  });

  // TC-REG-009: Success redirect to dashboard (callback tested)
  test('TC-REG-009: should call onSuccess after successful registration', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = jest.fn();

    mockPlayerService.register.mockResolvedValueOnce({
      user: {
        id: '1',
        email: 'newuser@example.com',
        username: 'newuser',
        countryCode: 'US'
      },
      token: 'mock-token',
      expiresAt: new Date(Date.now() + 3600000),
    });

    renderRegisterForm({ onSuccess: mockOnSuccess });

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });

    await user.type(usernameInput, 'newuser');
    await user.type(emailInput, 'newuser@example.com');

    // Open country select
    const countryTrigger = screen.getByRole('combobox');
    await user.click(countryTrigger);
    const usOption = await screen.findByText('United States');
    await user.click(usOption);

    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  // TC-REG-010: Accessibility compliance (ARIA labels)
  test('TC-REG-010: should have proper ARIA labels for form fields', () => {
    renderRegisterForm();

    const usernameInput = screen.getByLabelText(/username/i);
    const emailInput = screen.getByLabelText(/^email/i);
    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    expect(usernameInput).toHaveAttribute('id', 'username');
    expect(emailInput).toHaveAttribute('id', 'email');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(confirmPasswordInput).toHaveAttribute('type', 'password');
  });
});
