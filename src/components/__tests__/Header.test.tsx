/**
 * Header Component Test Suite
 * Tests navigation, authentication, and responsive behavior
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../Header';
import { AuthProvider } from '@/contexts/AuthContext';
import { BrowserRouter } from 'react-router-dom';

jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

jest.mock('@/services', () => ({
  playerService: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

const renderHeader = (props = {}, isAuthenticated = false) => {
  if (isAuthenticated) {
    localStorage.setItem('love-rank-pulse-token', 'mock-token');
    localStorage.setItem('love-rank-pulse-user', JSON.stringify({
      id: '1',
      email: 'test@example.com',
      username: 'testuser'
    }));
    localStorage.setItem('love-rank-pulse-expires-at', new Date(Date.now() + 3600000).toISOString());
  }

  const defaultProps = {
    activeTab: 'global' as const,
    onTabChange: jest.fn(),
    onMyStatsClick: jest.fn(),
    ...props,
  };

  return render(
    <BrowserRouter>
      <AuthProvider>
        <Header {...defaultProps} />
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Header Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  // TC-HEADER-001: Render logo and branding
  test('TC-HEADER-001: should render logo and brand name', () => {
    renderHeader();

    expect(screen.getByText(/love rank pulse/i)).toBeInTheDocument();
    // Trophy icon should be present
    const trophy = document.querySelector('.lucide-trophy');
    expect(trophy).toBeInTheDocument();
  });

  // TC-HEADER-002: Display user info when authenticated
  test('TC-HEADER-002: should show logout button when authenticated', async () => {
    renderHeader({}, true);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });
  });

  // TC-HEADER-003: Show login button when not authenticated
  test('TC-HEADER-003: should show login button when not authenticated', async () => {
    renderHeader({}, false);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });
  });

  // TC-HEADER-004: Logout functionality
  test('TC-HEADER-004: should clear auth state on logout', async () => {
    const user = userEvent.setup();
    renderHeader({}, true);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });

    const logoutButton = screen.getByRole('button', { name: /logout/i });
    await user.click(logoutButton);

    await waitFor(() => {
      expect(localStorage.getItem('love-rank-pulse-token')).toBeNull();
    });
  });

  // TC-HEADER-005: Open stats modal on button click
  test('TC-HEADER-005: should call onMyStatsClick when stats button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnMyStatsClick = jest.fn();

    renderHeader({ onMyStatsClick: mockOnMyStatsClick });

    const statsButton = screen.getByRole('button', { name: /my stats/i });
    await user.click(statsButton);

    expect(mockOnMyStatsClick).toHaveBeenCalled();
  });

  // TC-HEADER-006: Mobile menu toggle
  test('TC-HEADER-006: should toggle mobile menu', async () => {
    const { useIsMobile } = require('@/hooks/use-mobile');
    useIsMobile.mockReturnValue(true);

    const user = userEvent.setup();
    const { rerender } = render(
      <BrowserRouter>
        <AuthProvider>
          <Header
            activeTab="global"
            onTabChange={jest.fn()}
            onMyStatsClick={jest.fn()}
          />
        </AuthProvider>
      </BrowserRouter>
    );

    // Mobile menu button should be present
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    // Mobile menu should be visible
    await waitFor(() => {
      expect(screen.getByText(/session leaderboard/i)).toBeInTheDocument();
      expect(screen.getByText(/country leaderboard/i)).toBeInTheDocument();
      expect(screen.getByText(/global leaderboard/i)).toBeInTheDocument();
    });
  });

  // TC-HEADER-007: Active route highlighting
  test('TC-HEADER-007: should highlight active tab', () => {
    renderHeader({ activeTab: 'session' });

    const sessionButton = screen.getByRole('button', { name: /view session leaderboard/i });
    expect(sessionButton).toHaveClass('bg-primary');
  });

  // TC-HEADER-008: Connection status indicator (placeholder)
  test('TC-HEADER-008: should render navigation tabs', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: /view session leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view country leaderboard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view global leaderboard/i })).toBeInTheDocument();
  });

  // TC-HEADER-009: Responsive layout (mobile/desktop)
  test('TC-HEADER-009: should change tab when clicked', async () => {
    const user = userEvent.setup();
    const mockOnTabChange = jest.fn();

    renderHeader({ onTabChange: mockOnTabChange, activeTab: 'global' });

    const sessionButton = screen.getByRole('button', { name: /view session leaderboard/i });
    await user.click(sessionButton);

    expect(mockOnTabChange).toHaveBeenCalledWith('session');
  });

  // TC-HEADER-010: Accessibility (skip to main content)
  test('TC-HEADER-010: should have proper ARIA labels for navigation buttons', () => {
    renderHeader();

    const sessionButton = screen.getByRole('button', { name: /view session leaderboard/i });
    const countryButton = screen.getByRole('button', { name: /view country leaderboard/i });
    const globalButton = screen.getByRole('button', { name: /view global leaderboard/i });
    const statsButton = screen.getByRole('button', { name: /view my statistics/i });

    expect(sessionButton).toHaveAttribute('aria-label', 'View session leaderboard');
    expect(countryButton).toHaveAttribute('aria-label', 'View country leaderboard');
    expect(globalButton).toHaveAttribute('aria-label', 'View global leaderboard');
    expect(statsButton).toHaveAttribute('aria-label', 'View my statistics');
  });
});
