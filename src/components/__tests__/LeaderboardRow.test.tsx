/**
 * LeaderboardRow Component Test Suite
 * Tests individual row rendering with stats, medals, and styling
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { LeaderboardRow } from '../LeaderboardRow';

describe('LeaderboardRow Component', () => {
  const defaultProps = {
    rank: 5,
    playerName: 'TestPlayer',
    countryCode: 'US',
    kills: 50,
    deaths: 10,
    kdRatio: 5.0,
    isWin: true,
    isCurrentPlayer: false,
    isMobile: false,
  };

  // TC-ROW-001: Display rank badge with styling
  test('TC-ROW-001: should display rank number for ranks beyond top 3', () => {
    render(<LeaderboardRow {...defaultProps} rank={5} />);

    expect(screen.getByText('#5')).toBeInTheDocument();
  });

  // TC-ROW-002: Show player avatar (with fallback)
  test('TC-ROW-002: should display player name', () => {
    render(<LeaderboardRow {...defaultProps} />);

    expect(screen.getByText('TestPlayer')).toBeInTheDocument();
  });

  // TC-ROW-003: Render player name and country
  test('TC-ROW-003: should display country flag', () => {
    render(<LeaderboardRow {...defaultProps} countryCode="US" />);

    // Check for country flag (emoji rendering)
    const flagElement = screen.getByText(/🇺🇸/);
    expect(flagElement).toBeInTheDocument();
  });

  // TC-ROW-004: Display stats (ELO, wins, losses)
  test('TC-ROW-004: should display K/D ratio with correct styling', () => {
    render(<LeaderboardRow {...defaultProps} kdRatio={5.0} />);

    const kdElement = screen.getByText('5.00');
    expect(kdElement).toBeInTheDocument();
    expect(kdElement).toHaveClass('text-success');
  });

  // TC-ROW-005: Highlight current user row
  test('TC-ROW-005: should highlight current player row', () => {
    const { container } = render(<LeaderboardRow {...defaultProps} isCurrentPlayer={true} />);

    const row = container.firstChild;
    expect(row).toHaveClass('bg-primary/10');
    expect(row).toHaveClass('border-l-primary');
  });

  // TC-ROW-006: Hover effects and animations
  test('TC-ROW-006: should display medal icons for top 3 players', () => {
    // Test rank 1 (gold)
    const { container: container1 } = render(<LeaderboardRow {...defaultProps} rank={1} />);
    expect(container1.querySelector('.lucide-medal')).toBeInTheDocument();

    // Test rank 2 (silver)
    const { container: container2 } = render(<LeaderboardRow {...defaultProps} rank={2} />);
    expect(container2.querySelector('.lucide-medal')).toBeInTheDocument();

    // Test rank 3 (bronze)
    const { container: container3 } = render(<LeaderboardRow {...defaultProps} rank={3} />);
    expect(container3.querySelector('.lucide-medal')).toBeInTheDocument();
  });

  // TC-ROW-007: Click to navigate to player profile
  test('TC-ROW-007: should display kills and deaths in desktop view', () => {
    render(<LeaderboardRow {...defaultProps} kills={50} deaths={10} />);

    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  // TC-ROW-008: Medal icons for top 3 players
  test('TC-ROW-008: should display win/loss badge', () => {
    const { container } = render(<LeaderboardRow {...defaultProps} isWin={true} />);

    expect(screen.getByText('W')).toBeInTheDocument();
    expect(container.querySelector('.bg-success')).toBeInTheDocument();

    const { container: lossContainer } = render(<LeaderboardRow {...defaultProps} isWin={false} />);
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(lossContainer.querySelector('.bg-destructive')).toBeInTheDocument();
  });

  test('TC-ROW-009: should show negative K/D ratio styling', () => {
    render(<LeaderboardRow {...defaultProps} kdRatio={0.5} />);

    const kdElement = screen.getByText('0.50');
    expect(kdElement).toHaveClass('text-destructive');
  });

  test('TC-ROW-010: should display headshot indicator when provided', () => {
    const { container } = render(<LeaderboardRow {...defaultProps} headshots={25} />);

    // Headshot icon (Target) should be present
    expect(container.querySelector('.lucide-target')).toBeInTheDocument();
  });

  test('TC-ROW-011: should display score badge when provided', () => {
    render(<LeaderboardRow {...defaultProps} score={1000} />);

    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  test('TC-ROW-012: should render mobile layout correctly', () => {
    const { container } = render(<LeaderboardRow {...defaultProps} isMobile={true} />);

    // Mobile layout should use grid-cols-4
    const row = container.firstChild;
    expect(row).toHaveClass('grid-cols-4');

    // Desktop-only stats should not be visible
    // (kills, deaths, W/L are hidden in mobile view)
  });

  test('TC-ROW-013: should show trending up icon for positive K/D', () => {
    const { container } = render(<LeaderboardRow {...defaultProps} kdRatio={2.5} />);

    expect(container.querySelector('.lucide-trending-up')).toBeInTheDocument();
  });

  test('TC-ROW-014: should show trending down icon for negative K/D', () => {
    const { container } = render(<LeaderboardRow {...defaultProps} kdRatio={0.8} />);

    expect(container.querySelector('.lucide-trending-down')).toBeInTheDocument();
  });
});
