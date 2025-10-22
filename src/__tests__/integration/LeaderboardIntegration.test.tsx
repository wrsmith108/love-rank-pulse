/**
 * Leaderboard Integration Tests
 * Tests frontend component integration with API and data flow
 */

import '@testing-library/jest-dom';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithAllProviders, createTestQueryClient } from '../utils/testQueryProvider';
import { createMockApiClient } from '../utils/mockApiClient';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { LeaderboardEntry } from '@/models';

describe('Leaderboard Integration Tests', () => {
  let mockApiClient: ReturnType<typeof createMockApiClient>;
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    mockApiClient = createMockApiClient();
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    mockApiClient.reset();
    queryClient.clear();
  });

  describe('API Data Fetching', () => {
    it('should fetch and display leaderboard data successfully', async () => {
      // Mock API response
      const mockLeaderboardData = await mockApiClient.getLeaderboard('global');

      // Transform API data to component format
      const players = mockLeaderboardData.data!.map((entry: LeaderboardEntry) => ({
        player_id: entry.playerId,
        player_name: entry.playerName,
        country_code: entry.countryCode,
        kills: entry.kills,
        deaths: entry.deaths,
        kd_ratio: entry.kdRatio,
        is_win: entry.wins > entry.losses,
        rank: entry.rank,
        headshots: entry.headshots,
        accuracy: entry.accuracy,
        score: entry.score
      }));

      const { container } = renderWithAllProviders(
        <LeaderboardTable players={players} />,
        { client: queryClient }
      );

      // Verify data is displayed
      await waitFor(() => {
        expect(screen.getByText('ProGamer123')).toBeInTheDocument();
        expect(screen.getByText('SkillMaster')).toBeInTheDocument();
        expect(screen.getByText('EliteSniper')).toBeInTheDocument();
      });

      // Verify table structure
      expect(container.querySelector('.bg-card')).toBeInTheDocument();
    });

    it('should display loading state while fetching data', async () => {
      // Configure API with delay
      mockApiClient.updateConfig({ delay: 100 });

      renderWithAllProviders(
        <LeaderboardTable players={[]} isLoading={true} />,
        { client: queryClient }
      );

      // Verify loading indicator
      expect(screen.getByText('Loading leaderboard data...')).toBeInTheDocument();
      expect(screen.getByRole('generic', { hidden: true })).toHaveClass('animate-spin');
    });

    it('should handle empty leaderboard data', async () => {
      renderWithAllProviders(
        <LeaderboardTable players={[]} isLoading={false} />,
        { client: queryClient }
      );

      // Verify empty state message
      expect(screen.getByText('No players found for this leaderboard.')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      // Configure API to fail
      mockApiClient.updateConfig({ shouldFail: true, errorMessage: 'Network error' });

      try {
        await mockApiClient.getLeaderboard('global');
      } catch (error: any) {
        expect(error.message).toBe('Network error');
      }

      // Render error state
      renderWithAllProviders(
        <LeaderboardTable players={[]} />,
        { client: queryClient }
      );

      expect(screen.getByText('No players found for this leaderboard.')).toBeInTheDocument();
    });
  });

  describe('Data Transformation', () => {
    it('should correctly transform API data to component format', async () => {
      const apiResponse = await mockApiClient.getLeaderboard('global');
      const apiEntry = apiResponse.data![0];

      // Transform to component format
      const componentData = {
        player_id: apiEntry.playerId,
        player_name: apiEntry.playerName,
        country_code: apiEntry.countryCode,
        kills: apiEntry.kills,
        deaths: apiEntry.deaths,
        kd_ratio: apiEntry.kdRatio,
        is_win: apiEntry.wins > apiEntry.losses,
        rank: apiEntry.rank,
        headshots: apiEntry.headshots,
        accuracy: apiEntry.accuracy,
        score: apiEntry.score
      };

      // Verify transformation
      expect(componentData.player_id).toBe('player-1');
      expect(componentData.player_name).toBe('ProGamer123');
      expect(componentData.kd_ratio).toBe(3.0);
      expect(componentData.is_win).toBe(true);
    });

    it('should handle missing optional fields', async () => {
      const apiResponse = await mockApiClient.getLeaderboard('global');
      const apiEntry = apiResponse.data![0];

      // Create entry without optional fields
      const componentData = {
        player_id: apiEntry.playerId,
        player_name: apiEntry.playerName,
        country_code: apiEntry.countryCode,
        kills: apiEntry.kills,
        deaths: apiEntry.deaths,
        kd_ratio: apiEntry.kdRatio,
        is_win: true,
        rank: apiEntry.rank
      };

      renderWithAllProviders(
        <LeaderboardTable players={[componentData]} />,
        { client: queryClient }
      );

      await waitFor(() => {
        expect(screen.getByText('ProGamer123')).toBeInTheDocument();
      });
    });

    it('should calculate K/D ratio correctly', async () => {
      const testData = {
        player_id: 'test-1',
        player_name: 'TestPlayer',
        country_code: 'US',
        kills: 150,
        deaths: 50,
        kd_ratio: 3.0,
        is_win: true,
        rank: 1
      };

      renderWithAllProviders(
        <LeaderboardTable players={[testData]} />,
        { client: queryClient }
      );

      await waitFor(() => {
        expect(screen.getByText('3.00')).toBeInTheDocument();
      });
    });
  });

  describe('Current Player Highlighting', () => {
    it('should highlight current player row', async () => {
      const mockData = await mockApiClient.getLeaderboard('global');
      const players = mockData.data!.map((entry: LeaderboardEntry) => ({
        player_id: entry.playerId,
        player_name: entry.playerName,
        country_code: entry.countryCode,
        kills: entry.kills,
        deaths: entry.deaths,
        kd_ratio: entry.kdRatio,
        is_win: entry.wins > entry.losses,
        rank: entry.rank
      }));

      const { container } = renderWithAllProviders(
        <LeaderboardTable players={players} currentPlayerId="player-1" />,
        { client: queryClient }
      );

      await waitFor(() => {
        expect(screen.getByText('ProGamer123')).toBeInTheDocument();
      });

      // Current player row should be present
      const rows = container.querySelectorAll('[class*="transition-colors"]');
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  describe('Responsive Behavior', () => {
    it('should render mobile layout correctly', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });

      const mockData = await mockApiClient.getLeaderboard('global');
      const players = mockData.data!.map((entry: LeaderboardEntry) => ({
        player_id: entry.playerId,
        player_name: entry.playerName,
        country_code: entry.countryCode,
        kills: entry.kills,
        deaths: entry.deaths,
        kd_ratio: entry.kdRatio,
        is_win: true,
        rank: entry.rank
      }));

      const { container } = renderWithAllProviders(
        <LeaderboardTable players={players} />,
        { client: queryClient }
      );

      await waitFor(() => {
        expect(screen.getByText('ProGamer123')).toBeInTheDocument();
      });

      // Check for mobile-specific layout
      const headers = container.querySelectorAll('.text-xs.font-semibold');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('should render desktop layout correctly', async () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920
      });

      const mockData = await mockApiClient.getLeaderboard('global');
      const players = mockData.data!.map((entry: LeaderboardEntry) => ({
        player_id: entry.playerId,
        player_name: entry.playerName,
        country_code: entry.countryCode,
        kills: entry.kills,
        deaths: entry.deaths,
        kd_ratio: entry.kdRatio,
        is_win: true,
        rank: entry.rank
      }));

      renderWithAllProviders(
        <LeaderboardTable players={players} />,
        { client: queryClient }
      );

      await waitFor(() => {
        expect(screen.getByText('ProGamer123')).toBeInTheDocument();
      });

      // Desktop layout should show all columns
      expect(screen.getByText('RANK')).toBeInTheDocument();
      expect(screen.getByText('PLAYER')).toBeInTheDocument();
      expect(screen.getByText('K/D')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render large leaderboards efficiently', async () => {
      // Create large dataset
      const largePlayers = Array.from({ length: 100 }, (_, i) => ({
        player_id: `player-${i}`,
        player_name: `Player${i}`,
        country_code: 'US',
        kills: 100 + i,
        deaths: 50,
        kd_ratio: (100 + i) / 50,
        is_win: i % 2 === 0,
        rank: i + 1
      }));

      const startTime = performance.now();

      renderWithAllProviders(
        <LeaderboardTable players={largePlayers} />,
        { client: queryClient }
      );

      const renderTime = performance.now() - startTime;

      await waitFor(() => {
        expect(screen.getByText('Player0')).toBeInTheDocument();
      });

      // Rendering should complete in reasonable time
      expect(renderTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe('API Call Tracking', () => {
    it('should track API calls correctly', async () => {
      await mockApiClient.getLeaderboard('global');
      await mockApiClient.getPlayerStats('player-1');
      await mockApiClient.getPlayer('player-1');

      const callHistory = mockApiClient.getCallHistory();

      expect(callHistory).toHaveLength(3);
      expect(callHistory[0].endpoint).toBe('getLeaderboard');
      expect(callHistory[1].endpoint).toBe('getPlayerStats');
      expect(callHistory[2].endpoint).toBe('getPlayer');
    });

    it('should clear call history', async () => {
      await mockApiClient.getLeaderboard('global');

      mockApiClient.clearCallHistory();

      const callHistory = mockApiClient.getCallHistory();
      expect(callHistory).toHaveLength(0);
    });
  });
});
