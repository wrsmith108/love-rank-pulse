/**
 * WebSocket Server with Socket.io
 * Provides real-time communication for leaderboard updates, match events, and player notifications
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { ConnectionManager } from './connectionManager';
import {
  WebSocketConfig,
  TypedSocket,
  NamespaceType,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from './types';

/**
 * Default WebSocket configuration
 */
const DEFAULT_CONFIG: WebSocketConfig = {
  port: parseInt(process.env.PORT_WS || '3001', 10),
  corsOrigin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'],
  pingTimeout: 20000,
  pingInterval: 25000,
  connectionTimeout: 45000,
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
  maxReconnectDelay: 5000
};

export class WebSocketServer {
  private io!: SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  private connectionManager!: ConnectionManager;
  private config: WebSocketConfig;
  private httpServer?: HTTPServer;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer?: HTTPServer): SocketIOServer {
    this.httpServer = httpServer;

    // Create Socket.io server
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
      httpServer || this.config.port,
      {
        cors: {
          origin: this.config.corsOrigin,
          methods: ['GET', 'POST'],
          credentials: true
        },
        pingTimeout: this.config.pingTimeout,
        pingInterval: this.config.pingInterval,
        connectTimeout: this.config.connectionTimeout,
        maxHttpBufferSize: 1e6, // 1MB
        transports: ['websocket', 'polling'],
        allowEIO3: true
      }
    );

    // Initialize connection manager
    this.connectionManager = new ConnectionManager(this.io);

    // Setup namespaces and handlers
    this.setupNamespaces();
    this.setupMainNamespace();
    this.setupHealthCheck();

    console.log('='.repeat(50));
    console.log('🌐 WebSocket Server Initialized');
    console.log('='.repeat(50));
    if (!httpServer) {
      console.log(`WebSocket Port: ${this.config.port}`);
    }
    console.log(`CORS Origins: ${this.config.corsOrigin.join(', ')}`);
    console.log(`Ping Timeout: ${this.config.pingTimeout}ms`);
    console.log(`Connection Timeout: ${this.config.connectionTimeout}ms`);
    console.log('='.repeat(50));

    return this.io;
  }

  /**
   * Setup main namespace (/)
   */
  private setupMainNamespace(): void {
    this.io.on('connection', (socket: TypedSocket) => {
      this.connectionManager.handleConnection(socket, '/');

      // Log connection details
      console.log(`[WS] Client connected: ${socket.id}`);
      console.log(`[WS] Transport: ${socket.conn.transport.name}`);
      console.log(`[WS] Active connections: ${this.connectionManager.getActiveConnections()}`);
    });
  }

  /**
   * Setup namespaces for different event types
   */
  private setupNamespaces(): void {
    // Leaderboard namespace
    const leaderboardNs = this.io.of(NamespaceType.LEADERBOARD);
    leaderboardNs.on('connection', (socket: TypedSocket) => {
      this.connectionManager.handleConnection(socket, NamespaceType.LEADERBOARD);

      // Leaderboard subscription
      socket.on('leaderboard:subscribe', async (category?: string) => {
        const room = category ? `leaderboard:${category}` : 'leaderboard:all';
        await this.connectionManager.joinRoom(socket, room);
        console.log(`[WS] Client ${socket.id} subscribed to leaderboard: ${category || 'all'}`);
      });

      socket.on('leaderboard:unsubscribe', async (category?: string) => {
        const room = category ? `leaderboard:${category}` : 'leaderboard:all';
        await this.connectionManager.leaveRoom(socket, room);
        console.log(`[WS] Client ${socket.id} unsubscribed from leaderboard: ${category || 'all'}`);
      });
    });

    // Matches namespace
    const matchesNs = this.io.of(NamespaceType.MATCHES);
    matchesNs.on('connection', (socket: TypedSocket) => {
      this.connectionManager.handleConnection(socket, NamespaceType.MATCHES);

      // Match subscription
      socket.on('match:subscribe', async (matchId: string) => {
        const room = `match:${matchId}`;
        await this.connectionManager.joinRoom(socket, room);
        console.log(`[WS] Client ${socket.id} subscribed to match: ${matchId}`);
      });

      socket.on('match:unsubscribe', async (matchId: string) => {
        const room = `match:${matchId}`;
        await this.connectionManager.leaveRoom(socket, room);
        console.log(`[WS] Client ${socket.id} unsubscribed from match: ${matchId}`);
      });
    });

    // Players namespace
    const playersNs = this.io.of(NamespaceType.PLAYERS);
    playersNs.on('connection', (socket: TypedSocket) => {
      this.connectionManager.handleConnection(socket, NamespaceType.PLAYERS);

      // Player subscription
      socket.on('player:subscribe', async (playerId: string) => {
        const room = `player:${playerId}`;
        await this.connectionManager.joinRoom(socket, room);
        console.log(`[WS] Client ${socket.id} subscribed to player: ${playerId}`);
      });

      socket.on('player:unsubscribe', async (playerId: string) => {
        const room = `player:${playerId}`;
        await this.connectionManager.leaveRoom(socket, room);
        console.log(`[WS] Client ${socket.id} unsubscribed from player: ${playerId}`);
      });
    });

    console.log('[WS] Namespaces configured: /leaderboard, /matches, /players');
  }

  /**
   * Setup health check endpoint
   */
  private setupHealthCheck(): void {
    // Create a simple HTTP endpoint for health checks
    this.io.engine.on('connection_error', (err) => {
      console.error('[WS] Connection error:', err);
    });

    // Expose metrics endpoint
    setInterval(() => {
      const metrics = this.connectionManager.getMetrics();
      console.log(`[WS] Metrics - Active: ${metrics.activeConnections}, Total: ${metrics.totalConnections}, Rooms: ${metrics.totalRooms}`);
    }, 60000); // Log every minute
  }

  /**
   * Get connection manager instance
   */
  getConnectionManager(): ConnectionManager {
    return this.connectionManager;
  }

  /**
   * Get Socket.io server instance
   */
  getIO(): SocketIOServer {
    return this.io;
  }

  /**
   * Get server metrics
   */
  getMetrics() {
    return this.connectionManager.getMetrics();
  }

  /**
   * Broadcast event to all clients
   */
  broadcast(event: string, data: unknown): void {
    this.io.emit(event as any, data);
  }

  /**
   * Broadcast to specific room
   */
  broadcastToRoom(room: string, event: string, data: unknown): void {
    this.connectionManager.broadcastToRoom(room, event, data);
  }

  /**
   * Broadcast to specific namespace
   */
  broadcastToNamespace(namespace: NamespaceType, event: string, data: unknown): void {
    this.connectionManager.broadcastToNamespace(namespace, event, data);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[WS] Shutting down WebSocket server...');

    await this.connectionManager.shutdown();

    if (this.io) {
      this.io.close();
    }

    console.log('[WS] WebSocket server shutdown complete');
  }
}

/**
 * Create and export singleton instance
 */
export const wsServer = new WebSocketServer();

/**
 * Initialize WebSocket server with HTTP server
 */
export function initializeWebSocketServer(httpServer?: HTTPServer): SocketIOServer {
  return wsServer.initialize(httpServer);
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): WebSocketServer {
  return wsServer;
}

export default wsServer;
