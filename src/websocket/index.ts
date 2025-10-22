/**
 * WebSocket Module Exports
 * Central export file for WebSocket functionality
 */

export {
  WebSocketServer,
  wsServer,
  initializeWebSocketServer,
  getWebSocketServer
} from './server';

export { ConnectionManager } from './connectionManager';

export {
  // Type interfaces
  TypedSocket,
  TypedSocketServer,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,

  // Payload types
  LeaderboardUpdatePayload,
  RankChangePayload,
  MatchPayload,
  PlayerPayload,
  EloChangePayload,
  ConnectionPayload,
  ErrorPayload,

  // Configuration
  WebSocketConfig,

  // Enums
  RoomType,
  NamespaceType,

  // State types
  ConnectionState,
  ServerMetrics
} from './types';
