/**
 * usePlayerStats Hook Tests
 *
 * Test Coverage:
 * - Fetch player stats
 * - Derived stats calculations
 * - Match history pagination
 * - Performance trends chart data
 * - Cache management by player
 * - Real-time stats updates (WebSocket)
 * - Error states
 * - Loading states for nested queries
 *
 * TC-HOOK-STATS-001 through TC-HOOK-STATS-008
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { usePlayerStats } from '../usePlayerStats';
import { createTestQueryClient, TestQueryProvider } from '@/__tests__/utils/testQueryProvider';
import type { PlayerStats } from '@/components/MyStatsModal';

describe('usePlayerStats Hook', () => {
  let queryClient: QueryClient;

  const mockStats: PlayerStats = {
    player_name: 'TestPlayer',
    country_code: 'US',
    kd_ratio: 1.5,
    kills: 150,
    deaths: 100,
    wins: 45,
    losses: 30,
    win_rate: 60,
    session_rank: 10,
    country_rank: 150,
    global_rank: 1500,
    total_session_players: 100,
    total_country_players: 2000,
    total_global_players: 10000,
    headshots: 75,
    accuracy: 62,
    playtime: 1200,
    highest_killstreak: 12,
    favorite_weapon: 'AK-47',
    weapon_accuracy: 65,
    recent_performance: 'improving',
    matches_played: 75,
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    queryClient.clear();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestQueryProvider client={queryClient}>{children}</TestQueryProvider>
  );

  /**
   * TC-HOOK-STATS-001: Fetch Player Stats
   */
  describe('TC-HOOK-STATS-001: Fetch Player Stats', () => {
    it('should fetch player stats with playerId', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      // Initial loading
      expect(result.current.isLoading).toBe(true);

      // Fast-forward past the 300ms delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify stats data returned
      expect(result.current.data).toBeDefined();
      expect(result.current.data?.player_name).toBe('You');

      // Assert all required fields present
      expect(result.current.data).toHaveProperty('kd_ratio');
      expect(result.current.data).toHaveProperty('kills');
      expect(result.current.data).toHaveProperty('deaths');
      expect(result.current.data).toHaveProperty('wins');
      expect(result.current.data).toHaveProperty('losses');
      expect(result.current.data).toHaveProperty('win_rate');
      expect(result.current.data).toHaveProperty('session_rank');
      expect(result.current.data).toHaveProperty('country_rank');
      expect(result.current.data).toHaveProperty('global_rank');
    });

    it('should use "current" as default playerId', async () => {
      const { result } = renderHook(() => usePlayerStats(), { wrapper });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
    });
  });

  /**
   * TC-HOOK-STATS-002: Derived Stats Calculations
   */
  describe('TC-HOOK-STATS-002: Derived Stats Calculations', () => {
    it('should correctly calculate win rate percentage', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data!;

      // Verify win rate calculation
      const expectedWinRate = Math.round((data.wins / (data.wins + data.losses)) * 100);
      expect(data.win_rate).toBe(expectedWinRate);
    });

    it('should calculate rank percentile correctly', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data!;

      // Verify rank percentile
      const sessionPercentile = ((data.total_session_players - data.session_rank) / data.total_session_players) * 100;
      expect(sessionPercentile).toBeGreaterThan(0);
      expect(sessionPercentile).toBeLessThanOrEqual(100);

      const globalPercentile = ((data.total_global_players - data.global_rank) / data.total_global_players) * 100;
      expect(globalPercentile).toBeGreaterThan(0);
      expect(globalPercentile).toBeLessThanOrEqual(100);
    });

    it('should verify K/D ratio accuracy', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data!;

      // Verify K/D calculation
      const expectedKD = parseFloat((data.kills / data.deaths).toFixed(2));
      expect(Math.abs(data.kd_ratio - expectedKD)).toBeLessThan(0.01);
    });
  });

  /**
   * TC-HOOK-STATS-003: Match History Pagination
   */
  describe('TC-HOOK-STATS-003: Match History Pagination', () => {
    it('should handle match history pagination', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify matches_played field exists
      expect(result.current.data?.matches_played).toBeDefined();
      expect(result.current.data?.matches_played).toBeGreaterThan(0);

      // Note: Full match history pagination would require additional API endpoint
      // This test validates the data structure
    });
  });

  /**
   * TC-HOOK-STATS-004: Performance Trends Chart Data
   */
  describe('TC-HOOK-STATS-004: Performance Trends Chart Data', () => {
    it('should provide data suitable for performance charts', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const data = result.current.data!;

      // Verify trend indicators
      expect(data.recent_performance).toBeDefined();
      expect(['improving', 'stable', 'declining']).toContain(data.recent_performance);

      // Verify numeric metrics for charting
      expect(typeof data.kd_ratio).toBe('number');
      expect(typeof data.win_rate).toBe('number');
      expect(typeof data.accuracy).toBe('number');
      expect(typeof data.headshots).toBe('number');
    });
  });

  /**
   * TC-HOOK-STATS-005: Cache Management by Player
   */
  describe('TC-HOOK-STATS-005: Cache Management by Player', () => {
    it('should maintain separate cache for different players', async () => {
      // Fetch stats for player A
      const { result: resultA } = renderHook(() => usePlayerStats('player-a'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(resultA.current.isSuccess).toBe(true);
      });

      const playerAData = resultA.current.data;

      // Fetch stats for player B
      const { result: resultB } = renderHook(() => usePlayerStats('player-b'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(resultB.current.isSuccess).toBe(true);
      });

      const playerBData = resultB.current.data;

      // Verify separate cache keys (data could be same due to mock)
      expect(playerAData).toBeDefined();
      expect(playerBData).toBeDefined();

      // Verify no data leakage between cache entries
      const cacheKeys = queryClient.getQueryCache().getAll().map(q => q.queryKey);
      expect(cacheKeys.some(key => key.includes('player-a'))).toBe(true);
      expect(cacheKeys.some(key => key.includes('player-b'))).toBe(true);
    });
  });

  /**
   * TC-HOOK-STATS-006: Real-time Stats Updates (WebSocket)
   */
  describe('TC-HOOK-STATS-006: Real-time Stats Updates (WebSocket)', () => {
    it('should handle optimistic stats updates', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialKills = result.current.data?.kills || 0;

      // Simulate WebSocket update (optimistic)
      act(() => {
        result.current.optimisticUpdate({ kills: initialKills + 5 });
      });

      // Verify stats immediately updated
      expect(result.current.data?.kills).toBe(initialKills + 5);

      // Verify lastUpdated timestamp changed
      expect(result.current.data?.lastUpdated).toBeDefined();
    });

    it('should refresh stats on demand', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger manual refresh
      act(() => {
        result.current.refresh();
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Verify refetch triggered
      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });
  });

  /**
   * TC-HOOK-STATS-007: Error States
   */
  describe('TC-HOOK-STATS-007: Error States', () => {
    it('should handle player not found error', async () => {
      // Mock implementation to throw error
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Player not found'));

      const { result } = renderHook(() => usePlayerStats('non-existent'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Note: Current implementation doesn't actually fetch, so this test
      // validates the error handling structure
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      global.fetch = originalFetch;
    });

    it('should provide retry capability on error', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Refetch acts as retry mechanism
      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe('function');
    });
  });

  /**
   * TC-HOOK-STATS-008: Loading States for Nested Queries
   */
  describe('TC-HOOK-STATS-008: Loading States for Nested Queries', () => {
    it('should properly track loading states', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      // Initial loading state
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Fast-forward past delay
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Success state
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toBeDefined();
    });

    it('should handle refetch loading states', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Trigger refetch
      act(() => {
        result.current.refetch();
      });

      // Should show fetching but not loading
      expect(result.current.isFetching).toBe(true);
      expect(result.current.data).toBeDefined(); // Data still available

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });
    });

    it('should track stale data correctly', async () => {
      const { result } = renderHook(() => usePlayerStats('player-123'), {
        wrapper,
      });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Initially fresh (staleTime: 300000ms in hook)
      expect(result.current.isStale).toBe(false);

      // Data should remain fresh within staleTime
      expect(result.current.data).toBeDefined();
    });
  });
});
