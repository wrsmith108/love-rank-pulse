import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryKeys';
import type { Player } from '@/components/LeaderboardTable';
import type { PlayerStats } from '@/components/MyStatsModal';

/**
 * WebSocket event types
 */
interface WebSocketEvent {
  type: 'player_update' | 'rank_change' | 'match_end' | 'stats_update' | 'leaderboard_refresh';
  data: any;
  timestamp: number;
}

interface PlayerUpdateEvent {
  playerId: string;
  updates: Partial<Player>;
}

interface RankChangeEvent {
  playerId: string;
  oldRank: number;
  newRank: number;
  rankChange: number;
}

interface StatsUpdateEvent {
  playerId: string;
  stats: Partial<PlayerStats>;
}

/**
 * Hook for syncing WebSocket events with React Query cache
 *
 * Features:
 * - Optimistic updates from real-time events
 * - Automatic query invalidation
 * - Connection state management
 * - Reconnection handling
 */
export const useWebSocketSync = (enabled: boolean = true) => {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!enabled) return;

    const connectWebSocket = () => {
      try {
        // TODO: Replace with actual WebSocket URL from environment
        const wsUrl = process.env.VITE_WS_URL || 'ws://localhost:3001';
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('🔌 WebSocket connected');
          // Subscribe to relevant channels
          ws.send(JSON.stringify({ type: 'subscribe', channels: ['leaderboard', 'stats'] }));
        };

        ws.onmessage = (event) => {
          try {
            const wsEvent: WebSocketEvent = JSON.parse(event.data);
            handleWebSocketEvent(wsEvent);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected, attempting reconnection...');
          wsRef.current = null;

          // Reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };

    const handleWebSocketEvent = (event: WebSocketEvent) => {
      console.log('📡 WebSocket event:', event.type);

      switch (event.type) {
        case 'player_update':
          handlePlayerUpdate(event.data as PlayerUpdateEvent);
          break;

        case 'rank_change':
          handleRankChange(event.data as RankChangeEvent);
          break;

        case 'stats_update':
          handleStatsUpdate(event.data as StatsUpdateEvent);
          break;

        case 'match_end':
          handleMatchEnd();
          break;

        case 'leaderboard_refresh':
          handleLeaderboardRefresh();
          break;

        default:
          console.warn('Unknown WebSocket event type:', event.type);
      }
    };

    /**
     * Handle player data updates
     */
    const handlePlayerUpdate = (data: PlayerUpdateEvent) => {
      // Optimistically update all leaderboard queries that contain this player
      queryClient.setQueriesData<any>(
        { queryKey: queryKeys.leaderboard.lists() },
        (old: any) => {
          if (!old?.players) return old;

          return {
            ...old,
            players: old.players.map((p: Player) =>
              p.player_id === data.playerId
                ? { ...p, ...data.updates }
                : p
            ),
          };
        }
      );
    };

    /**
     * Handle rank changes with animation triggers
     */
    const handleRankChange = (data: RankChangeEvent) => {
      // Update player rank optimistically
      queryClient.setQueriesData<any>(
        { queryKey: queryKeys.leaderboard.lists() },
        (old: any) => {
          if (!old?.players) return old;

          return {
            ...old,
            players: old.players.map((p: Player) =>
              p.player_id === data.playerId
                ? {
                    ...p,
                    rank: data.newRank,
                    rankChange: data.rankChange,
                    rankChangeAnimation: true
                  }
                : p
            ),
          };
        }
      );

      // Clear animation flag after delay
      setTimeout(() => {
        queryClient.setQueriesData<any>(
          { queryKey: queryKeys.leaderboard.lists() },
          (old: any) => {
            if (!old?.players) return old;
            return {
              ...old,
              players: old.players.map((p: Player) =>
                p.player_id === data.playerId
                  ? { ...p, rankChangeAnimation: false }
                  : p
              ),
            };
          }
        );
      }, 2000);
    };

    /**
     * Handle player stats updates
     */
    const handleStatsUpdate = (data: StatsUpdateEvent) => {
      const queryKey = data.playerId === 'current'
        ? queryKeys.player.currentStats()
        : queryKeys.player.stat(data.playerId);

      queryClient.setQueryData<any>(queryKey, (old: any) => {
        if (!old) return old;
        return { ...old, ...data.stats, lastUpdated: new Date().toISOString() };
      });
    };

    /**
     * Handle match end events
     */
    const handleMatchEnd = () => {
      // Invalidate all queries when match ends
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.player.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.match.current() });
    };

    /**
     * Handle full leaderboard refresh requests
     */
    const handleLeaderboardRefresh = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.leaderboard.all,
        refetchType: 'active',
      });
    };

    // Initialize WebSocket connection
    connectWebSocket();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, queryClient]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    disconnect: () => wsRef.current?.close(),
  };
};
