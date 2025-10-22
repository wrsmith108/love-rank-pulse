import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryKeys';
import type { PlayerStats } from '@/components/MyStatsModal';

interface PlayerStatsResponse extends PlayerStats {
  lastUpdated: string;
}

const fetchPlayerStats = async (playerId: string): Promise<PlayerStatsResponse> => {
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {
    player_name: 'You',
    country_code: 'US',
    kd_ratio: 1.15,
    kills: 1564,
    deaths: 1356,
    wins: 124,
    losses: 73,
    win_rate: 63,
    session_rank: 15,
    country_rank: 234,
    global_rank: 1234,
    total_session_players: 100,
    total_country_players: 1847,
    total_global_players: 10000,
    headshots: 428,
    accuracy: 49,
    playtime: 1240,
    highest_killstreak: 12,
    favorite_weapon: 'AK-47 Tactical',
    weapon_accuracy: 52,
    recent_performance: 'improving',
    matches_played: 197,
    lastUpdated: new Date().toISOString(),
  };
};

export const usePlayerStats = (playerId: string = 'current') => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: playerId === 'current' 
      ? queryKeys.player.currentStats() 
      : queryKeys.player.stat(playerId),
    queryFn: () => fetchPlayerStats(playerId),
    staleTime: 300000,
    refetchInterval: 300000,
    enabled: !!playerId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: playerId === 'current'
        ? queryKeys.player.currentStats()
        : queryKeys.player.stat(playerId),
    });
  };

  const optimisticUpdate = (updates: Partial<PlayerStats>) => {
    const queryKey = playerId === 'current'
      ? queryKeys.player.currentStats()
      : queryKeys.player.stat(playerId);

    queryClient.setQueryData<PlayerStatsResponse>(queryKey, (old) => {
      if (!old) return old;
      return { ...old, ...updates, lastUpdated: new Date().toISOString() };
    });
  };

  return { ...query, refresh, optimisticUpdate };
};
