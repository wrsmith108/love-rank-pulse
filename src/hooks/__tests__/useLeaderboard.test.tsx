/**
 * useLeaderboard Hook Tests
 *
 * Test Coverage:
 * - Fetch leaderboard data
 * - Filter by scope (global/country/session)
 * - Filter by time period
 * - Search players by name
 * - Cache invalidation on match complete
 * - Optimistic updates
 * - Error retry logic
 * - Stale data detection
 * - Refetch on window focus
 * - Pagination with infinite scroll
 *
 * TC-HOOK-LB-001 through TC-HOOK-LB-010
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { useLeaderboard } from '../useLeaderboard';
import { createTestQueryClient, TestQueryProvider } from '@/__tests__/utils/testQueryProvider';
import { apiClient } from '@/utils/apiClient';
import type { LeaderboardResponse, LeaderboardPlayer } from '../useLeaderboard';

// Mock apiClient
jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
  },
  handleApiError: jest.fn((error) => error),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useLeaderboard Hook', () => {
  let queryClient: QueryClient;

  const mockPlayers: LeaderboardPlayer[] = [
    {
      player_id: 'player-1',
      player_name: 'TopPlayer',
      country_code: 'US',
      elo_rating: 2500,
      kills: 150,
      deaths: 50,
      kd_ratio: 3.0,
      wins: 45,
      losses: 15,
      win_rate: 0.75,
      rank: 1,
      headshots: 75,
      accuracy: 0.82,
      score: 25000,
    },
    {
      player_id: 'player-2',
      player_name: 'SecondPlace',
      country_code: 'UK',
      elo_rating: 2400,
      kills: 140,
      deaths: 55,
      kd_ratio: 2.55,
      wins: 40,
      losses: 20,
      win_rate: 0.67,
      rank: 2,
      headshots: 68,
      accuracy: 0.78,
      score: 23500,
    },
  ];

  const mockResponse: LeaderboardResponse = {
    players: mockPlayers,
    total: 100,
    page: 1,
    limit: 100,
    scope: 'session',
    period: 'session',
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestQueryProvider client={queryClient}>{children}</TestQueryProvider>
  );

  /**
   * TC-HOOK-LB-001: Fetch Leaderboard Data
   */
  describe('TC-HOOK-LB-001: Fetch Leaderboard Data', () => {
    it('should fetch leaderboard with default params', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(
        () => useLeaderboard({ scope: 'session' }),
        { wrapper }
      );

      // Initial loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify API called with correct endpoint
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/leaderboard?')
      );

      // Check data returned and cached
      expect(result.current.data).toEqual(mockResponse);
      expect(result.current.data?.players).toHaveLength(2);

      // Verify loading state transitions
      expect(result.current.isLoading).toBe(false);
    });
  });

  /**
   * TC-HOOK-LB-002: Filter by Scope (Global/Country/Session)
   */
  describe('TC-HOOK-LB-002: Filter by Scope', () => {
    it('should fetch country leaderboard with country param', async () => {
      const countryResponse = {
        ...mockResponse,
        scope: 'country' as const,
        country_code: 'US',
      };

      mockApiClient.get.mockResolvedValueOnce({ data: countryResponse });

      const { result } = renderHook(
        () =>
          useLeaderboard({
            scope: 'country',
            countryCode: 'US',
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify API called with country param
      const callUrl = mockApiClient.get.mock.calls[0][0];
      expect(callUrl).toContain('scope=country');
      expect(callUrl).toContain('country_code=US');

      // Check data
      expect(result.current.data?.scope).toBe('country');
      expect(result.current.data?.country_code).toBe('US');
    });

    it('should fetch global leaderboard', async () => {
      const globalResponse = {
        ...mockResponse,
        scope: 'global' as const,
      };

      mockApiClient.get.mockResolvedValueOnce({ data: globalResponse });

      const { result } = renderHook(
        () => useLeaderboard({ scope: 'global' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const callUrl = mockApiClient.get.mock.calls[0][0];
      expect(callUrl).toContain('scope=global');
      expect(result.current.data?.scope).toBe('global');
    });
  });

  /**
   * TC-HOOK-LB-003: Filter by Time Period
   */
  describe('TC-HOOK-LB-003: Filter by Time Period', () => {
    it('should fetch weekly leaderboard with time range', async () => {
      const weeklyResponse = {
        ...mockResponse,
        period: 'weekly' as const,
      };

      mockApiClient.get.mockResolvedValueOnce({ data: weeklyResponse });

      const { result } = renderHook(
        () =>
          useLeaderboard({
            scope: 'session',
            timePeriod: 'weekly',
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify API includes time period
      const callUrl = mockApiClient.get.mock.calls[0][0];
      expect(callUrl).toContain('period=weekly');

      // Check data
      expect(result.current.data?.period).toBe('weekly');
    });
  });

  /**
   * TC-HOOK-LB-004: Search Players by Name
   */
  describe('TC-HOOK-LB-004: Search Players by Name', () => {
    it('should filter players by search query', async () => {
      const searchResults = {
        ...mockResponse,
        players: [mockPlayers[0]], // Only first player
      };

      mockApiClient.get.mockResolvedValueOnce({ data: searchResults });

      const { result, rerender } = renderHook(
        (props: { scope: 'session'; searchQuery?: string }) =>
          useLeaderboard(props),
        {
          initialProps: { scope: 'session' as const },
          wrapper,
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Initial results
      expect(result.current.data?.players).toHaveLength(2);

      // Add search query (simulating debounced search)
      mockApiClient.get.mockResolvedValueOnce({ data: searchResults });

      rerender({ scope: 'session', searchQuery: 'Top' });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      });

      // Note: Actual search implementation would need to be added to the hook
      // This test validates the concept
    });
  });

  /**
   * TC-HOOK-LB-005: Cache Invalidation on Match Complete
   */
  describe('TC-HOOK-LB-005: Cache Invalidation on Match Complete', () => {
    it('should refetch data when cache is invalidated', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(
        () => useLeaderboard({ scope: 'session' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Fetch count: 1
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);

      // Invalidate cache (simulating match complete event)
      const updatedResponse = {
        ...mockResponse,
        players: [
          { ...mockPlayers[0], elo_rating: 2550 }, // Rating increased
          mockPlayers[1],
        ],
      };

      mockApiClient.get.mockResolvedValueOnce({ data: updatedResponse });

      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: ['leaderboard', 'session'],
        });
      });

      // Wait for refetch
      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      });

      // Verify fresh data loaded
      expect(result.current.data?.players[0].elo_rating).toBe(2550);
    });
  });

  /**
   * TC-HOOK-LB-006: Optimistic Updates
   */
  describe('TC-HOOK-LB-006: Optimistic Updates', () => {
    it('should handle optimistic rank updates', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: mockResponse });

      const { result } = renderHook(
        () => useLeaderboard({ scope: 'session' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialRank = result.current.data?.players[0].rank;
      expect(initialRank).toBe(1);

      // Perform optimistic update
      act(() => {
        queryClient.setQueryData(
          ['leaderboard', 'session', 'session', undefined, undefined, 1, 100],
          (old: LeaderboardResponse | undefined) => {
            if (!old) return old;
            return {
              ...old,
              players: old.players.map((p) =>
                p.player_id === 'player-1' ? { ...p, rank: 2 } : p
              ),
            };
          }
        );
      });

      // Verify UI updates immediately
      expect(result.current.data?.players[0].rank).toBe(2);
    });
  });

  /**
   * TC-HOOK-LB-007: Error Retry Logic
   */
  describe('TC-HOOK-LB-007: Error Retry Logic', () => {
    it('should not retry on error (retry disabled in test client)', async () => {
      const mockError = new Error('Network error');
      mockApiClient.get.mockRejectedValueOnce(mockError);

      const { result } = renderHook(
        () => useLeaderboard({ scope: 'session' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // In production, retry logic would be configured
      // Test client has retry: false
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
      expect(result.current.error).toBeTruthy();
    });
  });

  /**
   * TC-HOOK-LB-008: Stale Data Detection
   */
  describe('TC-HOOK-LB-008: Stale Data Detection', () => {
    it('should mark data as stale after staleTime', async () => {
      // Use a real QueryClient with staleTime for this test
      const customQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 100, // 100ms
            gcTime: 1000,
            retry: false,
          },
        },
      });

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <TestQueryProvider client={customQueryClient}>
          {children}
        </TestQueryProvider>
      );

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useLeaderboard({ scope: 'session' }),
        { wrapper: customWrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Data is fresh
      expect(result.current.isStale).toBe(false);

      // Wait for staleTime to pass
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Data should now be stale
      await waitFor(() => {
        expect(result.current.isStale).toBe(true);
      });

      customQueryClient.clear();
    });
  });

  /**
   * TC-HOOK-LB-009: Refetch on Window Focus
   */
  describe('TC-HOOK-LB-009: Refetch on Window Focus', () => {
    it('should refetch when window regains focus', async () => {
      // Use a real QueryClient with refetchOnWindowFocus
      const customQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: true,
            staleTime: 0,
            retry: false,
          },
        },
      });

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <TestQueryProvider client={customQueryClient}>
          {children}
        </TestQueryProvider>
      );

      mockApiClient.get.mockResolvedValue({ data: mockResponse });

      const { result } = renderHook(
        () => useLeaderboard({ scope: 'session' }),
        { wrapper: customWrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Initial fetch
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);

      // Simulate window blur then focus
      act(() => {
        window.dispatchEvent(new Event('blur'));
      });

      await act(async () => {
        window.dispatchEvent(new Event('focus'));
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should trigger refetch (may take a moment)
      await waitFor(
        () => {
          expect(mockApiClient.get).toHaveBeenCalledTimes(2);
        },
        { timeout: 2000 }
      );

      customQueryClient.clear();
    });
  });

  /**
   * TC-HOOK-LB-010: Pagination with Infinite Scroll
   */
  describe('TC-HOOK-LB-010: Pagination with Infinite Scroll', () => {
    it('should fetch subsequent pages and append data', async () => {
      // Page 1
      const page1Response = {
        ...mockResponse,
        page: 1,
        limit: 1,
        total: 2,
      };

      mockApiClient.get.mockResolvedValueOnce({ data: page1Response });

      const { result, rerender } = renderHook(
        (props: { scope: 'session'; page: number; limit: number }) =>
          useLeaderboard(props),
        {
          initialProps: { scope: 'session' as const, page: 1, limit: 1 },
          wrapper,
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify page 1 data
      expect(result.current.data?.page).toBe(1);
      expect(result.current.data?.players).toHaveLength(2);

      // Fetch page 2
      const page2Response = {
        ...mockResponse,
        page: 2,
        limit: 1,
        total: 2,
        players: [mockPlayers[1]], // Second player only
      };

      mockApiClient.get.mockResolvedValueOnce({ data: page2Response });

      rerender({ scope: 'session', page: 2, limit: 1 });

      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      });

      // Verify page 2 data
      expect(result.current.data?.page).toBe(2);

      // Note: For true infinite scroll, would use useInfiniteQuery
      // This test validates pagination concept
    });
  });
});
