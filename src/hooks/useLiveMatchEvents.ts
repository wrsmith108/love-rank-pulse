import { useState, useEffect, useCallback } from 'react';
import { useWebSocketContext, MatchEvent } from '@/contexts/WebSocketContext';

interface UseLiveMatchEventsOptions {
  matchId?: string;
  autoSubscribe?: boolean;
  onMatchEvent?: (event: MatchEvent) => void;
  onMatchStart?: (event: MatchEvent) => void;
  onMatchEnd?: (event: MatchEvent) => void;
  onKill?: (event: MatchEvent) => void;
  onDeath?: (event: MatchEvent) => void;
  onObjective?: (event: MatchEvent) => void;
}

/**
 * Hook to manage live match event subscriptions
 * Provides real-time updates for match events with typed handlers
 */
export const useLiveMatchEvents = ({
  matchId,
  autoSubscribe = true,
  onMatchEvent,
  onMatchStart,
  onMatchEnd,
  onKill,
  onDeath,
  onObjective
}: UseLiveMatchEventsOptions = {}) => {
  const {
    isConnected,
    matchesSocket,
    subscribeToMatches,
    unsubscribeFromMatches
  } = useWebSocketContext();

  const [lastEvent, setLastEvent] = useState<MatchEvent | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [matchStarted, setMatchStarted] = useState(false);
  const [matchEnded, setMatchEnded] = useState(false);

  /**
   * Handle incoming match events
   */
  const handleMatchEvent = useCallback((event: MatchEvent) => {
    console.log('[Match] Event received:', event);
    setLastEvent(event);
    setEventCount(prev => prev + 1);

    // Call general event handler
    onMatchEvent?.(event);

    // Call specific event handlers based on event type
    switch (event.event_type) {
      case 'start':
        setMatchStarted(true);
        setMatchEnded(false);
        onMatchStart?.(event);
        break;
      case 'end':
        setMatchEnded(true);
        onMatchEnd?.(event);
        break;
      case 'kill':
        onKill?.(event);
        break;
      case 'death':
        onDeath?.(event);
        break;
      case 'objective':
        onObjective?.(event);
        break;
    }
  }, [onMatchEvent, onMatchStart, onMatchEnd, onKill, onDeath, onObjective]);

  /**
   * Subscribe to match events
   */
  useEffect(() => {
    if (!isConnected || !matchesSocket || !autoSubscribe) {
      return;
    }

    // Subscribe to matches
    subscribeToMatches(matchId);

    // Set up event listener
    matchesSocket.on('matchEvent', handleMatchEvent);

    console.log(`[Match] Subscribed to ${matchId ? `match:${matchId}` : 'all matches'}`);

    // Cleanup
    return () => {
      matchesSocket.off('matchEvent', handleMatchEvent);
      unsubscribeFromMatches(matchId);
      console.log(`[Match] Unsubscribed from ${matchId ? `match:${matchId}` : 'all matches'}`);
    };
  }, [
    isConnected,
    matchesSocket,
    matchId,
    autoSubscribe,
    subscribeToMatches,
    unsubscribeFromMatches,
    handleMatchEvent
  ]);

  /**
   * Manual subscribe/unsubscribe methods
   */
  const subscribe = useCallback(() => {
    if (isConnected) {
      subscribeToMatches(matchId);
    }
  }, [isConnected, subscribeToMatches, matchId]);

  const unsubscribe = useCallback(() => {
    if (isConnected) {
      unsubscribeFromMatches(matchId);
    }
  }, [isConnected, unsubscribeFromMatches, matchId]);

  /**
   * Reset match state
   */
  const resetMatchState = useCallback(() => {
    setMatchStarted(false);
    setMatchEnded(false);
    setLastEvent(null);
    setEventCount(0);
  }, []);

  return {
    isConnected,
    lastEvent,
    eventCount,
    matchStarted,
    matchEnded,
    subscribe,
    unsubscribe,
    resetMatchState
  };
};
