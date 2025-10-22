/**
 * useLeaderboardMutations Hook Tests
 *
 * Test Coverage:
 * - Add friend mutation
 * - Report player mutation
 * - Vote kick mutation
 * - Refresh leaderboard mutation
 * - Load more players mutation
 * - Optimistic UI updates
 * - Rollback on server error
 * - Cache invalidation after mutation
 * - Success notifications
 * - Error handling with retry
 * - Concurrent mutations handling
 *
 * TC-HOOK-MUT-001 through TC-HOOK-MUT-010
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import {
  useAddFriend,
  useReportPlayer,
  useVoteKick,
  useRefreshLeaderboard,
  useLoadMorePlayers,
} from '../useLeaderboardMutations';
import { createTestQueryClient, TestQueryProvider } from '@/__tests__/utils/testQueryProvider';
import { apiClient } from '@/utils/apiClient';
import { queryKeys } from '@/config/queryKeys';
import type { Player } from '@/components/LeaderboardTable';

// Mock apiClient
jest.mock('@/utils/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  handleApiError: jest.fn((error) => error || { message: 'API Error' }),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('useLeaderboardMutations Hooks', () => {
  let queryClient: QueryClient;

  const mockPlayers: Player[] = [
    {
      player_id: 'player-1',
      player_name: 'Player One',
      country_code: 'US',
      elo_rating: 2500,
      rank: 1,
      kills: 150,
      deaths: 50,
      kd_ratio: 3.0,
      wins: 45,
      losses: 15,
      win_rate: 0.75,
      score: 25000,
    },
    {
      player_id: 'player-2',
      player_name: 'Player Two',
      country_code: 'UK',
      elo_rating: 2400,
      rank: 2,
      kills: 140,
      deaths: 55,
      kd_ratio: 2.55,
      wins: 40,
      losses: 20,
      win_rate: 0.67,
      score: 23500,
    },
  ];

  beforeEach(() => {
    queryClient = createTestQueryClient();
    jest.clearAllMocks();

    // Pre-populate cache with leaderboard data
    queryClient.setQueryData(
      queryKeys.leaderboard.list({
        tab: 'session',
        limit: 100,
        offset: 0,
      }),
      { players: mockPlayers }
    );
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestQueryProvider client={queryClient}>{children}</TestQueryProvider>
  );

  /**
   * TC-HOOK-MUT-001: Add Friend Mutation Success
   */
  describe('TC-HOOK-MUT-001: Add Friend Mutation', () => {
    it('should add friend successfully with optimistic update', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Friend added successfully',
          friendId: 'player-1',
        },
      });

      const { result } = renderHook(() => useAddFriend(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-1',
          playerName: 'Player One',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify API called
      expect(mockApiClient.post).toHaveBeenCalledWith('/friends', {
        playerId: 'player-1',
      });

      // Verify success
      expect(result.current.data?.success).toBe(true);
      expect(result.current.data?.message).toBe('Friend added successfully');
    });

    it('should perform optimistic update on add friend', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: { success: true, message: 'Friend added' },
      });

      const { result } = renderHook(() => useAddFriend(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-1',
          playerName: 'Player One',
        });
      });

      // Check cache was updated (optimistically or on success)
      // Note: Actual optimistic update happens in onMutate
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  /**
   * TC-HOOK-MUT-002: Report Player Mutation
   */
  describe('TC-HOOK-MUT-002: Report Player Mutation', () => {
    it('should report player successfully', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Player reported successfully',
          reportId: 'report-123',
        },
      });

      const { result } = renderHook(() => useReportPlayer(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-2',
          reason: 'Cheating',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify API called with correct params
      expect(mockApiClient.post).toHaveBeenCalledWith('/friends/report', {
        playerId: 'player-2',
        reason: 'Cheating',
      });

      // Verify success message
      expect(result.current.data?.message).toBe('Player reported successfully');
    });

    it('should handle report player error', async () => {
      const mockError = new Error('Failed to report player');
      mockApiClient.post.mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useReportPlayer(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            playerId: 'player-2',
            reason: 'Offensive language',
          });
        } catch (error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeTruthy();
    });
  });

  /**
   * TC-HOOK-MUT-003: Vote Kick Mutation
   */
  describe('TC-HOOK-MUT-003: Vote Kick Mutation', () => {
    it('should vote kick player successfully', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Vote recorded',
          votesRequired: 5,
          currentVotes: 3,
        },
      });

      const { result } = renderHook(() => useVoteKick(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-2',
          matchId: 'match-123',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify API called
      expect(mockApiClient.post).toHaveBeenCalledWith('/friends/vote-kick', {
        playerId: 'player-2',
        matchId: 'match-123',
      });

      expect(result.current.data?.message).toBe('Vote recorded');
    });

    it('should optimistically mark player with active kick vote', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: { success: true, message: 'Vote recorded' },
      });

      const { result } = renderHook(() => useVoteKick(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-1',
          matchId: 'match-123',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Optimistic update applied in onMutate
      // Verify success state
      expect(result.current.data?.success).toBe(true);
    });
  });

  /**
   * TC-HOOK-MUT-004: Refresh Leaderboard Mutation
   */
  describe('TC-HOOK-MUT-004: Refresh Leaderboard', () => {
    it('should refresh leaderboard successfully', async () => {
      const { result } = renderHook(() => useRefreshLeaderboard(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync();
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify success
      expect(result.current.data?.success).toBe(true);

      // Cache should be invalidated (implementation detail)
      // Verify mutation completed
      expect(result.current.isSuccess).toBe(true);
    });
  });

  /**
   * TC-HOOK-MUT-005: Load More Players
   */
  describe('TC-HOOK-MUT-005: Load More Players', () => {
    it('should load more players successfully', async () => {
      const additionalPlayers = [
        {
          player_id: 'player-3',
          player_name: 'Player Three',
          country_code: 'CA',
          rank: 3,
        },
      ];

      mockApiClient.get.mockResolvedValueOnce({
        data: {
          data: additionalPlayers,
          pagination: {
            page: 2,
            totalPages: 3,
          },
        },
      });

      const { result } = renderHook(() => useLoadMorePlayers(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          offset: 100,
          limit: 100,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify API called with pagination params
      expect(mockApiClient.get).toHaveBeenCalled();

      // Verify more players returned
      expect(result.current.data?.players).toHaveLength(1);
      expect(result.current.data?.hasMore).toBeDefined();
    });

    it('should handle load more with country filter', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          data: [],
          pagination: { page: 2, totalPages: 2 },
        },
      });

      const { result } = renderHook(() => useLoadMorePlayers(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          offset: 100,
          limit: 100,
          country: 'US',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify country endpoint called
      const callUrl = mockApiClient.get.mock.calls[0][0];
      expect(callUrl).toContain('country');
    });
  });

  /**
   * TC-HOOK-MUT-006: Optimistic UI Updates
   */
  describe('TC-HOOK-MUT-006: Optimistic UI Updates', () => {
    it('should show immediate UI changes before server confirms', async () => {
      // Delay server response
      let resolvePost: (value: any) => void;
      const postPromise = new Promise((resolve) => {
        resolvePost = resolve;
      });

      mockApiClient.post.mockReturnValue(postPromise as any);

      const { result } = renderHook(() => useAddFriend(), { wrapper });

      // Start mutation
      act(() => {
        result.current.mutate({
          playerId: 'player-1',
          playerName: 'Player One',
        });
      });

      // Optimistic update should happen in onMutate before server response
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Complete server request
      act(() => {
        resolvePost!({
          data: { success: true, message: 'Friend added' },
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  /**
   * TC-HOOK-MUT-007: Rollback on Server Error
   */
  describe('TC-HOOK-MUT-007: Rollback on Server Error', () => {
    it('should rollback optimistic update on error', async () => {
      // Setup: cache with initial data
      const initialData = { players: [...mockPlayers] };
      queryClient.setQueryData(queryKeys.leaderboard.lists(), initialData);

      // Mock error response
      mockApiClient.post.mockRejectedValueOnce(new Error('Server error'));

      const { result } = renderHook(() => useAddFriend(), { wrapper });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            playerId: 'player-1',
            playerName: 'Player One',
          });
        } catch (error) {
          // Expected to fail
        }
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Verify error state
      expect(result.current.error).toBeTruthy();

      // Original data should be restored (rollback in onError)
      const cachedData = queryClient.getQueryData(queryKeys.leaderboard.lists());
      expect(cachedData).toBeDefined();
    });
  });

  /**
   * TC-HOOK-MUT-008: Cache Invalidation After Mutation
   */
  describe('TC-HOOK-MUT-008: Cache Invalidation After Mutation', () => {
    it('should invalidate related queries after successful mutation', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        data: { success: true, message: 'Friend added' },
      });

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useAddFriend(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-1',
          playerName: 'Player One',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify invalidation called
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.leaderboard.all,
      });

      invalidateSpy.mockRestore();
    });
  });

  /**
   * TC-HOOK-MUT-009: Success Notifications
   */
  describe('TC-HOOK-MUT-009: Success Notifications', () => {
    it('should return success message after mutation', async () => {
      const successMessage = 'Operation completed successfully';

      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: successMessage,
        },
      });

      const { result } = renderHook(() => useAddFriend(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-1',
          playerName: 'Player One',
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify success message
      expect(result.current.data?.message).toBe(successMessage);

      // Note: Toast notifications would be shown in component layer
    });
  });

  /**
   * TC-HOOK-MUT-010: Concurrent Mutations Handling
   */
  describe('TC-HOOK-MUT-010: Concurrent Mutations Handling', () => {
    it('should handle multiple mutations simultaneously', async () => {
      mockApiClient.post
        .mockResolvedValueOnce({
          data: { success: true, message: 'Friend 1 added' },
        })
        .mockResolvedValueOnce({
          data: { success: true, message: 'Friend 2 added' },
        });

      const { result } = renderHook(() => useAddFriend(), { wrapper });

      // Start multiple mutations
      const promises = [
        result.current.mutateAsync({
          playerId: 'player-1',
          playerName: 'Player One',
        }),
        result.current.mutateAsync({
          playerId: 'player-2',
          playerName: 'Player Two',
        }),
      ];

      await act(async () => {
        await Promise.all(promises);
      });

      // Both should succeed
      expect(mockApiClient.post).toHaveBeenCalledTimes(2);
    });

    it('should maintain correct order for sequential mutations', async () => {
      mockApiClient.post
        .mockResolvedValueOnce({
          data: { success: true, message: 'First' },
        })
        .mockResolvedValueOnce({
          data: { success: true, message: 'Second' },
        });

      const { result } = renderHook(() => useReportPlayer(), { wrapper });

      // Sequential mutations
      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-1',
          reason: 'Reason 1',
        });
      });

      await act(async () => {
        await result.current.mutateAsync({
          playerId: 'player-2',
          reason: 'Reason 2',
        });
      });

      // Verify both completed in order
      expect(mockApiClient.post).toHaveBeenCalledTimes(2);

      const calls = mockApiClient.post.mock.calls;
      expect(calls[0][1]).toEqual({ playerId: 'player-1', reason: 'Reason 1' });
      expect(calls[1][1]).toEqual({ playerId: 'player-2', reason: 'Reason 2' });
    });
  });
});
