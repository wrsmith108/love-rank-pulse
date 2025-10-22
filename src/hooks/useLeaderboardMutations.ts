import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryKeys';
import type { Player } from '@/components/LeaderboardTable';
import { apiClient, handleApiError } from '@/utils/apiClient';
import type {
  AddFriendResponse,
  ReportPlayerResponse,
  VoteKickResponse,
  LoadMorePlayersResponse,
  RefreshLeaderboardResponse,
} from '@/types/mutations';

/**
 * Hook for leaderboard mutations (actions that modify data)
 *
 * Features:
 * - Optimistic updates for instant UI feedback
 * - Automatic rollback on errors
 * - Query invalidation on success
 * - Real API integration with axios
 * - Type-safe responses with proper error handling
 */

interface AddFriendParams {
  playerId: string;
  playerName: string;
}

interface ReportPlayerParams {
  playerId: string;
  reason: string;
}

interface VoteKickParams {
  playerId: string;
  matchId: string;
}

/**
 * Add a friend
 */
export const useAddFriend = () => {
  const queryClient = useQueryClient();

  return useMutation<AddFriendResponse, Error, AddFriendParams>({
    mutationFn: async (params: AddFriendParams) => {
      try {
        const response = await apiClient.post<AddFriendResponse>('/friends', {
          playerId: params.playerId,
        });
        return response.data;
      } catch (error) {
        const apiError = handleApiError(error);
        throw new Error(apiError.message || 'Failed to add friend');
      }
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.leaderboard.all });

      // Snapshot previous value
      const previousData = queryClient.getQueriesData({
        queryKey: queryKeys.leaderboard.all,
      });

      // Optimistically update player as friend
      queryClient.setQueriesData<any>(
        { queryKey: queryKeys.leaderboard.lists() },
        (old: any) => {
          if (!old?.players) return old;
          return {
            ...old,
            players: old.players.map((p: Player) =>
              p.player_id === params.playerId
                ? { ...p, isFriend: true }
                : p
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      console.error('Failed to add friend:', err.message);
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
      console.log('Friend added successfully:', data.message);
    },
  });
};

/**
 * Report a player
 */
export const useReportPlayer = () => {
  const queryClient = useQueryClient();

  return useMutation<ReportPlayerResponse, Error, ReportPlayerParams>({
    mutationFn: async (params: ReportPlayerParams) => {
      try {
        const response = await apiClient.post<ReportPlayerResponse>('/friends/report', {
          playerId: params.playerId,
          reason: params.reason,
        });
        return response.data;
      } catch (error) {
        const apiError = handleApiError(error);
        throw new Error(apiError.message || 'Failed to report player');
      }
    },
    onSuccess: (data, variables) => {
      // Show success notification
      console.log('Player reported successfully:', data.message);
    },
    onError: (err) => {
      console.error('Failed to report player:', err.message);
    },
  });
};

/**
 * Vote to kick a player
 */
export const useVoteKick = () => {
  const queryClient = useQueryClient();

  return useMutation<VoteKickResponse, Error, VoteKickParams>({
    mutationFn: async (params: VoteKickParams) => {
      try {
        const response = await apiClient.post<VoteKickResponse>('/friends/vote-kick', {
          playerId: params.playerId,
          matchId: params.matchId,
        });
        return response.data;
      } catch (error) {
        const apiError = handleApiError(error);
        throw new Error(apiError.message || 'Failed to vote kick player');
      }
    },
    onMutate: async (params) => {
      // Optimistically mark player as having active kick vote
      queryClient.setQueriesData<any>(
        { queryKey: queryKeys.leaderboard.lists() },
        (old: any) => {
          if (!old?.players) return old;
          return {
            ...old,
            players: old.players.map((p: Player) =>
              p.player_id === params.playerId
                ? { ...p, hasActiveKickVote: true }
                : p
            ),
          };
        }
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
      console.log('Vote kick successful:', data.message);
    },
    onError: (err) => {
      console.error('Failed to vote kick player:', err.message);
    },
  });
};

/**
 * Refresh leaderboard manually
 */
export const useRefreshLeaderboard = () => {
  const queryClient = useQueryClient();

  return useMutation<RefreshLeaderboardResponse, Error, void>({
    mutationFn: async () => {
      try {
        // Force refetch all leaderboard queries
        await queryClient.invalidateQueries({
          queryKey: queryKeys.leaderboard.all,
          refetchType: 'active',
        });
        return { success: true };
      } catch (error) {
        const apiError = handleApiError(error);
        throw new Error(apiError.message || 'Failed to refresh leaderboard');
      }
    },
    onSuccess: () => {
      console.log('Leaderboard refreshed successfully');
    },
    onError: (err) => {
      console.error('Failed to refresh leaderboard:', err.message);
    },
  });
};

/**
 * Load more leaderboard entries
 */
export const useLoadMorePlayers = () => {
  return useMutation<
    LoadMorePlayersResponse,
    Error,
    { offset: number; limit: number; type?: string; country?: string }
  >({
    mutationFn: async (params: { offset: number; limit: number; type?: string; country?: string }) => {
      try {
        const endpoint = params.country
          ? `/leaderboard/country/${params.country}`
          : '/leaderboard/global';

        const page = Math.floor(params.offset / params.limit) + 1;

        const response = await apiClient.get(endpoint, {
          params: {
            page,
            limit: params.limit,
          },
        });

        return {
          players: response.data.data || [],
          hasMore: response.data.pagination.page < response.data.pagination.totalPages,
        };
      } catch (error) {
        const apiError = handleApiError(error);
        throw new Error(apiError.message || 'Failed to load more players');
      }
    },
    onError: (err) => {
      console.error('Failed to load more players:', err.message);
    },
  });
};
