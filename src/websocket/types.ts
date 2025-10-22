/**
 * WebSocket Type Definitions
 * Centralized type definitions for Socket.io events and namespaces
 */

import { Server as SocketIOServer, Socket } from 'socket.io';

/**
 * Custom Socket.io server interface with typed namespaces
 */
export interface TypedSocketServer extends SocketIOServer {
  // Namespaces will be accessed dynamically
}

/**
 * Client-to-Server Events
 */
export interface ClientToServerEvents {
  // Leaderboard events
  'leaderboard:subscribe': (category?: string) => void;
  'leaderboard:unsubscribe': (category?: string) => void;

  // Match events
  'match:subscribe': (matchId: string) => void;
  'match:unsubscribe': (matchId: string) => void;

  // Player events
  'player:subscribe': (playerId: string) => void;
  'player:unsubscribe': (playerId: string) => void;

  // Room management
  'room:join': (room: string) => void;
  'room:leave': (room: string) => void;

  // Health check
  'ping': () => void;
}

/**
 * Server-to-Client Events
 */
export interface ServerToClientEvents {
  // Leaderboard updates
  'leaderboard:update': (data: LeaderboardUpdatePayload) => void;
  'leaderboard:rankChange': (data: RankChangePayload) => void;

  // Match updates
  'match:created': (data: MatchPayload) => void;
  'match:updated': (data: MatchPayload) => void;
  'match:completed': (data: MatchPayload) => void;

  // Player updates
  'player:updated': (data: PlayerPayload) => void;
  'player:eloChange': (data: EloChangePayload) => void;

  // Connection events
  'connection:established': (data: ConnectionPayload) => void;
  'connection:error': (error: ErrorPayload) => void;

  // Health check
  'pong': (timestamp: number) => void;
}

/**
 * Inter-Server Events (for horizontal scaling)
 */
export interface InterServerEvents {
  broadcast: (event: string, data: unknown) => void;
}

/**
 * Socket Data (attached to each socket connection)
 */
export interface SocketData {
  userId?: string;
  sessionId: string;
  connectedAt: number;
  rooms: Set<string>;
  metadata?: Record<string, unknown>;
}

/**
 * Typed Socket with all event interfaces
 */
export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Event Payload Interfaces
 */

export interface LeaderboardUpdatePayload {
  category: string;
  players: Array<{
    id: string;
    name: string;
    rank: number;
    elo: number;
    wins: number;
    losses: number;
    winRate: number;
  }>;
  timestamp: number;
}

export interface RankChangePayload {
  playerId: string;
  playerName: string;
  oldRank: number;
  newRank: number;
  category: string;
  timestamp: number;
}

export interface MatchPayload {
  id: string;
  player1Id: string;
  player2Id: string;
  winner?: string;
  player1Elo?: number;
  player2Elo?: number;
  category?: string;
  timestamp: number;
}

export interface PlayerPayload {
  id: string;
  name: string;
  elo: number;
  rank?: number;
  wins: number;
  losses: number;
  winRate: number;
  timestamp: number;
}

export interface EloChangePayload {
  playerId: string;
  playerName: string;
  oldElo: number;
  newElo: number;
  change: number;
  matchId: string;
  timestamp: number;
}

export interface ConnectionPayload {
  socketId: string;
  sessionId: string;
  timestamp: number;
  server: {
    version: string;
    uptime: number;
  };
}

export interface ErrorPayload {
  code: string;
  message: string;
  timestamp: number;
  details?: unknown;
}

/**
 * WebSocket Configuration
 */
export interface WebSocketConfig {
  port: number;
  corsOrigin: string[];
  pingTimeout: number;
  pingInterval: number;
  connectionTimeout: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
}

/**
 * Room/Namespace Types
 */
export enum RoomType {
  LEADERBOARD = 'leaderboard',
  MATCH = 'match',
  PLAYER = 'player',
  GLOBAL = 'global'
}

export enum NamespaceType {
  LEADERBOARD = '/leaderboard',
  MATCHES = '/matches',
  PLAYERS = '/players',
  ADMIN = '/admin'
}

/**
 * Connection State
 */
export interface ConnectionState {
  socketId: string;
  sessionId: string;
  connectedAt: number;
  lastPing: number;
  rooms: string[];
  userId?: string;
}

/**
 * Server Metrics
 */
export interface ServerMetrics {
  totalConnections: number;
  activeConnections: number;
  totalRooms: number;
  uptime: number;
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  reconnections: number;
}
