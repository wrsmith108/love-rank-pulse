/**
 * AuthTest Component Test Suite
 * Tests authentication test component functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthTest } from '../AuthTest';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

jest.mock('@/services', () => ({
  playerService: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

const renderAuthTest = () => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AuthTest />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('AuthTest Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // TC-AUTHTEST-001: Display current auth status
  test('TC-AUTHTEST-001: should display unauthenticated status', async () => {
    renderAuthTest();

    await waitFor(() => {
      expect(screen.getByText(/you are not authenticated/i)).toBeInTheDocument();
    });
  });

  // TC-AUTHTEST-002: Test login flow
  test('TC-AUTHTEST-002: should open auth modal when login button is clicked', async () => {
    const user = userEvent.setup();
    renderAuthTest();

    await waitFor(() => {
      expect(screen.getByText(/you are not authenticated/i)).toBeInTheDocument();
    });

    const loginButton = screen.getByRole('button', { name: /login \/ register/i });
    await user.click(loginButton);

    // Auth modal should open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // TC-AUTHTEST-003: Test logout functionality
  test('TC-AUTHTEST-003: should display logout button when authenticated', async () => {
    // Set up authenticated state
    localStorage.setItem('love-rank-pulse-token', 'mock-token');
    localStorage.setItem('love-rank-pulse-user', JSON.stringify({
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      countryCode: 'US'
    }));
    localStorage.setItem('love-rank-pulse-expires-at', new Date(Date.now() + 3600000).toISOString());

    renderAuthTest();

    await waitFor(() => {
      expect(screen.getByText(/authenticated user/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });
  });

  // TC-AUTHTEST-004: Display JWT token details
  test('TC-AUTHTEST-004: should display user details when authenticated', async () => {
    // Set up authenticated state
    localStorage.setItem('love-rank-pulse-token', 'mock-token');
    localStorage.setItem('love-rank-pulse-user', JSON.stringify({
      id: '1',
      email: 'test@example.com',
      username: 'testuser',
      countryCode: 'US'
    }));
    localStorage.setItem('love-rank-pulse-expires-at', new Date(Date.now() + 3600000).toISOString());

    renderAuthTest();

    await waitFor(() => {
      expect(screen.getByText(/testuser/i)).toBeInTheDocument();
      expect(screen.getByText(/test@example\.com/i)).toBeInTheDocument();
      expect(screen.getByText(/US/i)).toBeInTheDocument();
    });
  });
});
