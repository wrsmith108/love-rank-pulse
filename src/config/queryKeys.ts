/**
 * Query Key Factory for React Query
 *
 * Centralized query key management for consistent cache invalidation
 * and optimistic updates across the application.
 */

export const queryKeys = {
  // Leaderboard queries
  leaderboard: {
    all: ['leaderboard'] as const,
    lists: () => [...queryKeys.leaderboard.all, 'list'] as const,
    list: (filters: {
      tab: 'session' | 'country' | 'global';
      timePeriod?: string;
      sortBy?: string;
      friendsOnly?: boolean;
      limit?: number;
      offset?: number;
    }) => [...queryKeys.leaderboard.lists(), filters] as const,
    details: () => [...queryKeys.leaderboard.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.leaderboard.details(), id] as const,
  },

  // Player stats queries
  player: {
    all: ['player'] as const,
    stats: () => [...queryKeys.player.all, 'stats'] as const,
    stat: (playerId: string) => [...queryKeys.player.stats(), playerId] as const,
    currentStats: () => [...queryKeys.player.stats(), 'current'] as const,
  },

  // Match/Session queries
  match: {
    all: ['match'] as const,
    current: () => [...queryKeys.match.all, 'current'] as const,
    history: () => [...queryKeys.match.all, 'history'] as const,
    detail: (matchId: string) => [...queryKeys.match.all, matchId] as const,
  },

  // Real-time WebSocket data
  realtime: {
    all: ['realtime'] as const,
    leaderboard: () => [...queryKeys.realtime.all, 'leaderboard'] as const,
    playerUpdate: (playerId: string) =>
      [...queryKeys.realtime.all, 'player', playerId] as const,
  },
} as const;

// Type helpers for query key inference
export type QueryKey = typeof queryKeys;
export type LeaderboardFilters = Parameters<typeof queryKeys.leaderboard.list>[0];
