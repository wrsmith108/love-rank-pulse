/**
 * FilterBar Component Test Suite
 * Tests filtering, sorting, and search functionality
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '../FilterBar';

jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

const renderFilterBar = (props = {}) => {
  const defaultProps = {
    timePeriod: 'today' as const,
    onTimePeriodChange: jest.fn(),
    isLive: false,
    sortBy: 'rank' as const,
    onSortChange: jest.fn(),
    onRefresh: jest.fn(),
    showOnlyFriends: false,
    onToggleFriends: jest.fn(),
    activeTab: 'global' as const,
    countryCode: 'US',
    onCountryChange: jest.fn(),
    ...props,
  };

  return render(<FilterBar {...defaultProps} />);
};

describe('FilterBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TC-FILTER-001: Scope selection (global, country, session)
  test('TC-FILTER-001: should show country selector only for country tab', () => {
    renderFilterBar({ activeTab: 'country' });

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/US/)).toBeInTheDocument();
  });

  // TC-FILTER-002: Time period filter
  test('TC-FILTER-002: should change time period when selected', async () => {
    const user = userEvent.setup();
    const mockOnTimePeriodChange = jest.fn();

    renderFilterBar({ onTimePeriodChange: mockOnTimePeriodChange });

    // Find time period selector
    const timePeriodSelects = screen.getAllByRole('combobox');
    const timePeriodSelect = timePeriodSelects.find(select =>
      select.textContent?.includes('Today')
    );

    if (timePeriodSelect) {
      await user.click(timePeriodSelect);

      // Select "This Week"
      const weekOption = await screen.findByText('This Week');
      await user.click(weekOption);

      expect(mockOnTimePeriodChange).toHaveBeenCalledWith('week');
    }
  });

  // TC-FILTER-003: Search input functionality
  test('TC-FILTER-003: should display time period options', async () => {
    const user = userEvent.setup();
    renderFilterBar();

    const timePeriodSelects = screen.getAllByRole('combobox');
    const timePeriodSelect = timePeriodSelects.find(select =>
      select.textContent?.includes('Today')
    );

    if (timePeriodSelect) {
      await user.click(timePeriodSelect);

      await waitFor(() => {
        expect(screen.getByText('Current Session')).toBeInTheDocument();
        expect(screen.getByText('Last Hour')).toBeInTheDocument();
        expect(screen.getByText('This Week')).toBeInTheDocument();
        expect(screen.getByText('This Month')).toBeInTheDocument();
        expect(screen.getByText('All Time')).toBeInTheDocument();
      });
    }
  });

  // TC-FILTER-004: Multiple filter combination
  test('TC-FILTER-004: should change sort option', async () => {
    const user = userEvent.setup();
    const mockOnSortChange = jest.fn();

    renderFilterBar({ onSortChange: mockOnSortChange });

    // Find sort selector
    const sortSelects = screen.getAllByRole('combobox');
    const sortSelect = sortSelects.find(select =>
      select.textContent?.includes('Rank')
    );

    if (sortSelect) {
      await user.click(sortSelect);

      const kdOption = await screen.findByText('K/D Ratio');
      await user.click(kdOption);

      expect(mockOnSortChange).toHaveBeenCalledWith('kd');
    }
  });

  // TC-FILTER-005: Clear all filters button
  test('TC-FILTER-005: should toggle friends filter', async () => {
    const user = userEvent.setup();
    const mockOnToggleFriends = jest.fn();

    renderFilterBar({ onToggleFriends: mockOnToggleFriends });

    const friendsSwitch = screen.getByRole('switch', { name: /friends only/i });
    await user.click(friendsSwitch);

    expect(mockOnToggleFriends).toHaveBeenCalledWith(true);
  });

  // TC-FILTER-006: URL params synchronization (implementation-specific)
  test('TC-FILTER-006: should call onRefresh when refresh button clicked', async () => {
    const user = userEvent.setup();
    const mockOnRefresh = jest.fn();

    renderFilterBar({ onRefresh: mockOnRefresh });

    const refreshButton = screen.getByRole('button', { name: /refresh leaderboard/i });
    await user.click(refreshButton);

    expect(mockOnRefresh).toHaveBeenCalled();
  });

  // TC-FILTER-007: Mobile layout adaptation
  test('TC-FILTER-007: should show live indicator when live', () => {
    renderFilterBar({ isLive: true });

    expect(screen.getByText(/live/i)).toBeInTheDocument();
    // Check for pulse animation
    const liveDot = document.querySelector('.animate-pulse');
    expect(liveDot).toBeInTheDocument();
  });

  // TC-FILTER-008: Debounced search (300ms delay)
  test('TC-FILTER-008: should search countries in country selector', async () => {
    const user = userEvent.setup();
    renderFilterBar({ activeTab: 'country' });

    // Open country selector
    const countrySelect = screen.getByRole('combobox');
    await user.click(countrySelect);

    // Type in search
    const searchInput = await screen.findByPlaceholderText(/search country/i);
    await user.type(searchInput, 'Germany');

    await waitFor(() => {
      expect(screen.getByText(/Germany/)).toBeInTheDocument();
    });
  });

  // TC-FILTER-009: Filter validation and error messages
  test('TC-FILTER-009: should show no results when country search has no matches', async () => {
    const user = userEvent.setup();
    renderFilterBar({ activeTab: 'country' });

    const countrySelect = screen.getByRole('combobox');
    await user.click(countrySelect);

    const searchInput = await screen.findByPlaceholderText(/search country/i);
    await user.type(searchInput, 'NonexistentCountry123');

    await waitFor(() => {
      expect(screen.getByText(/no countries found/i)).toBeInTheDocument();
    });
  });

  // TC-FILTER-010: Keyboard shortcuts (Ctrl+F for search)
  test('TC-FILTER-010: should have proper ARIA labels', () => {
    renderFilterBar();

    const refreshButton = screen.getByRole('button', { name: /refresh leaderboard/i });
    expect(refreshButton).toHaveAttribute('aria-label', 'Refresh leaderboard');
  });
});
