import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryKeys';
import type { Player } from '@/components/LeaderboardTable';
import type { PlayerStats } from '@/components/MyStatsModal';

interface WebSocketContextValue {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  send: (message: any) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  autoConnect = true,
}) => {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [isConnected, setIsConnected] = useState(false);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const wsUrl = import.meta.env.VITE_WS_URL;

      // Skip WebSocket connection if no URL is configured (MVP deployment)
      if (!wsUrl) {
        console.log('WebSocket URL not configured, skipping connection');
        return;
      }

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        ws.send(JSON.stringify({ type: 'subscribe', channels: ['leaderboard', 'stats'] }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(() => connect(), 3000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  };

  const send = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'player_update':
        queryClient.setQueriesData<any>(
          { queryKey: queryKeys.leaderboard.lists() },
          (old: any) => {
            if (!old?.players) return old;
            return {
              ...old,
              players: old.players.map((p: Player) =>
                p.player_id === message.data.playerId ? { ...p, ...message.data.updates } : p
              ),
            };
          }
        );
        break;
      case 'rank_change':
        queryClient.setQueriesData<any>(
          { queryKey: queryKeys.leaderboard.lists() },
          (old: any) => {
            if (!old?.players) return old;
            return {
              ...old,
              players: old.players.map((p: Player) =>
                p.player_id === message.data.playerId
                  ? { ...p, rank: message.data.newRank, rankChange: message.data.rankChange }
                  : p
              ),
            };
          }
        );
        break;
      case 'stats_update':
        const queryKey = message.data.playerId === 'current'
          ? queryKeys.player.currentStats()
          : queryKeys.player.stat(message.data.playerId);
        queryClient.setQueryData<any>(queryKey, (old: any) => {
          if (!old) return old;
          return { ...old, ...message.data.stats, lastUpdated: new Date().toISOString() };
        });
        break;
      case 'match_end':
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.player.all });
        break;
      case 'leaderboard_refresh':
        queryClient.invalidateQueries({
          queryKey: queryKeys.leaderboard.all,
          refetchType: 'active',
        });
        break;
    }
  };

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect]);

  return (
    <WebSocketContext.Provider value={{ isConnected, connect, disconnect, send }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};
