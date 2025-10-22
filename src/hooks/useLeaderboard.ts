/**
 * useLeaderboard Hook - Fetch Leaderboard Data by Scope
 *
 * Features:
 * - Fetch leaderboard data for different scopes (session, country, global)
 * - React Query integration for caching and automatic refetching
 * - Loading and error states
 * - Pagination support
 * - Real-time updates (optional)
 *
 * @module hooks/useLeaderboard
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { apiClient, handleApiError, ApiError } from '@/utils/apiClient';

/**
 * Leaderboard scope types
 */
export type LeaderboardScope = 'session' | 'country' | 'global';

/**
 * Time period for historical leaderboards
 */
export type TimePeriod = 'session' | 'daily' | 'weekly' | 'monthly' | 'alltime';

/**
 * Player data structure from API
 */
export interface LeaderboardPlayer {
  player_id: string;
  player_name: string;
  country_code: string;
  elo_rating: number;
  kills: number;
  deaths: number;
  kd_ratio: number;
  wins: number;
  losses: number;
  win_rate: number;
  rank: number;
  headshots?: number;
  accuracy?: number;
  score?: number;
  is_win?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Leaderboard API response
 */
export interface LeaderboardResponse {
  players: LeaderboardPlayer[];
  total: number;
  page: number;
  limit: number;
  scope: LeaderboardScope;
  period?: TimePeriod;
  country_code?: string;
  session_id?: string;
}

/**
 * Hook options
 */
export interface UseLeaderboardOptions {
  scope: LeaderboardScope;
  timePeriod?: TimePeriod;
  countryCode?: string;
  sessionId?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number; // Auto-refetch interval in ms (0 = disabled)
}

/**
 * Fetch leaderboard data from API
 */
const fetchLeaderboard = async (
  options: UseLeaderboardOptions
): Promise<LeaderboardResponse> => {
  const {
    scope,
    timePeriod = 'session',
    countryCode,
    sessionId,
    page = 1,
    limit = 100,
  } = options;

  const params = new URLSearchParams({
    scope,
    period: timePeriod,
    page: page.toString(),
    limit: limit.toString(),
  });

  if (countryCode) {
    params.append('country_code', countryCode);
  }

  if (sessionId) {
    params.append('session_id', sessionId);
  }

  try {
    const response = await apiClient.get<LeaderboardResponse>(
      `/leaderboard?${params.toString()}`
    );
    return response.data;
  } catch (error) {
    throw handleApiError(error);
  }
};

/**
 * useLeaderboard Hook
 *
 * @param options - Hook configuration options
 * @returns Query result with leaderboard data
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useLeaderboard({
 *   scope: 'session',
 *   timePeriod: 'session',
 *   refetchInterval: 5000, // Refetch every 5 seconds
 * });
 * ```
 */
export const useLeaderboard = (
  options: UseLeaderboardOptions
): UseQueryResult<LeaderboardResponse, ApiError> => {
  const {
    scope,
    timePeriod = 'session',
    countryCode,
    sessionId,
    page = 1,
    limit = 100,
    enabled = true,
    refetchInterval = 0,
  } = options;

  return useQuery<LeaderboardResponse, ApiError>({
    queryKey: ['leaderboard', scope, timePeriod, countryCode, sessionId, page, limit],
    queryFn: () => fetchLeaderboard(options),
    enabled,
    refetchInterval,
    staleTime: getStaleTime(scope),
    gcTime: getGcTime(scope), // formerly cacheTime
  });
};

/**
 * Get stale time based on scope
 * Determines how long data is considered fresh
 */
const getStaleTime = (scope: LeaderboardScope): number => {
  switch (scope) {
    case 'session':
      return 30 * 1000; // 30 seconds
    case 'country':
      return 2 * 60 * 1000; // 2 minutes
    case 'global':
      return 5 * 60 * 1000; // 5 minutes
    default:
      return 60 * 1000; // 1 minute default
  }
};

/**
 * Get garbage collection time based on scope
 * Determines how long data stays in cache when unused
 */
const getGcTime = (scope: LeaderboardScope): number => {
  switch (scope) {
    case 'session':
      return 5 * 60 * 1000; // 5 minutes
    case 'country':
      return 10 * 60 * 1000; // 10 minutes
    case 'global':
      return 15 * 60 * 1000; // 15 minutes
    default:
      return 10 * 60 * 1000; // 10 minutes default
  }
};

export default useLeaderboard;
