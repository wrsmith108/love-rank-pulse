import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryKeys';
import type { Player } from '@/components/LeaderboardTable';

/**
 * Hook for leaderboard mutations (actions that modify data)
 *
 * Features:
 * - Optimistic updates for instant UI feedback
 * - Automatic rollback on errors
 * - Query invalidation on success
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

  return useMutation({
    mutationFn: async (params: AddFriendParams) => {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/friends', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(params),
      // });
      // if (!response.ok) throw new Error('Failed to add friend');
      // return response.json();

      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true };
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
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
    },
  });
};

/**
 * Report a player
 */
export const useReportPlayer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ReportPlayerParams) => {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, reportId: `report-${Date.now()}` };
    },
    onSuccess: (data, variables) => {
      // Show success notification
      console.log('Player reported successfully:', variables.playerId);
    },
  });
};

/**
 * Vote to kick a player
 */
export const useVoteKick = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: VoteKickParams) => {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, votesNeeded: 3, currentVotes: 1 };
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
    },
  });
};

/**
 * Refresh leaderboard manually
 */
export const useRefreshLeaderboard = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Force refetch all leaderboard queries
      await queryClient.invalidateQueries({
        queryKey: queryKeys.leaderboard.all,
        refetchType: 'active',
      });
      return { success: true };
    },
  });
};

/**
 * Load more leaderboard entries
 */
export const useLoadMorePlayers = () => {
  return useMutation({
    mutationFn: async (params: { offset: number; limit: number }) => {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { players: [], hasMore: false };
    },
  });
};
