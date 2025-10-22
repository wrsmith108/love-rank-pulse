import { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext, RankChangeEvent, LeaderboardUpdateEvent, SubscriptionScope } from '@/contexts/WebSocketContext';

interface UseRealtimeLeaderboardOptions {
  scope: SubscriptionScope;
  autoSubscribe?: boolean;
  onRankChange?: (event: RankChangeEvent) => void;
  onLeaderboardUpdate?: (event: LeaderboardUpdateEvent) => void;
}

/**
 * Hook to manage real-time leaderboard updates
 * Automatically subscribes to specified scope and handles rank changes
 */
export const useRealtimeLeaderboard = ({
  scope,
  autoSubscribe = true,
  onRankChange,
  onLeaderboardUpdate
}: UseRealtimeLeaderboardOptions) => {
  const {
    isConnected,
    leaderboardSocket,
    subscribeToLeaderboard,
    unsubscribeFromLeaderboard
  } = useWebSocketContext();

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [updateCount, setUpdateCount] = useState(0);

  /**
   * Handle rank change events
   */
  const handleRankChange = useCallback((data: RankChangeEvent) => {
    console.log('[Leaderboard] Rank change:', data);
    setLastUpdate(new Date());
    setUpdateCount(prev => prev + 1);
    onRankChange?.(data);
  }, [onRankChange]);

  /**
   * Handle full leaderboard updates
   */
  const handleLeaderboardUpdate = useCallback((data: LeaderboardUpdateEvent) => {
    console.log('[Leaderboard] Full update:', data);
    setLastUpdate(new Date());
    setUpdateCount(prev => prev + 1);
    onLeaderboardUpdate?.(data);
  }, [onLeaderboardUpdate]);

  /**
   * Subscribe to leaderboard updates
   */
  useEffect(() => {
    if (!isConnected || !leaderboardSocket || !autoSubscribe) {
      return;
    }

    // Subscribe to the scope
    subscribeToLeaderboard(scope);

    // Set up event listeners
    leaderboardSocket.on('rankChange', handleRankChange);
    leaderboardSocket.on('leaderboardUpdate', handleLeaderboardUpdate);

    console.log(`[Leaderboard] Subscribed to ${scope}`);

    // Cleanup
    return () => {
      leaderboardSocket.off('rankChange', handleRankChange);
      leaderboardSocket.off('leaderboardUpdate', handleLeaderboardUpdate);
      unsubscribeFromLeaderboard(scope);
      console.log(`[Leaderboard] Unsubscribed from ${scope}`);
    };
  }, [
    isConnected,
    leaderboardSocket,
    scope,
    autoSubscribe,
    subscribeToLeaderboard,
    unsubscribeFromLeaderboard,
    handleRankChange,
    handleLeaderboardUpdate
  ]);

  /**
   * Manual subscribe/unsubscribe methods
   */
  const subscribe = useCallback(() => {
    if (isConnected) {
      subscribeToLeaderboard(scope);
    }
  }, [isConnected, subscribeToLeaderboard, scope]);

  const unsubscribe = useCallback(() => {
    if (isConnected) {
      unsubscribeFromLeaderboard(scope);
    }
  }, [isConnected, unsubscribeFromLeaderboard, scope]);

  return {
    isConnected,
    lastUpdate,
    updateCount,
    subscribe,
    unsubscribe
  };
};
