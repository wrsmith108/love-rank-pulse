import { useEffect } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';

/**
 * Hook to manage main WebSocket connection
 * Provides connection state and control methods
 */
export const useWebSocket = () => {
  const {
    connectionState,
    isConnected,
    error,
    mainSocket,
    connect,
    disconnect
  } = useWebSocketContext();

  /**
   * Auto-connect on mount if not connected
   */
  useEffect(() => {
    if (!isConnected && !mainSocket) {
      connect();
    }
  }, [isConnected, mainSocket, connect]);

  return {
    connectionState,
    isConnected,
    error,
    socket: mainSocket,
    connect,
    disconnect
  };
};
