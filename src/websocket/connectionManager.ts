/**
 * WebSocket Connection Manager
 * Handles client connections, disconnections, room management, and broadcasting
 */

import { Server as SocketIOServer } from 'socket.io';
import {
  TypedSocket,
  ConnectionState,
  ServerMetrics,
  RoomType,
  NamespaceType,
  ConnectionPayload,
  ErrorPayload
} from './types';

export class ConnectionManager {
  private connections: Map<string, ConnectionState> = new Map();
  private metrics: ServerMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalRooms: 0,
    uptime: Date.now(),
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    reconnections: 0
  };

  constructor(private io: SocketIOServer) {
    this.setupMetricsTracking();
  }

  /**
   * Handle new client connection
   */
  handleConnection(socket: TypedSocket, namespace: string = '/'): void {
    const sessionId = this.generateSessionId();
    const connectionState: ConnectionState = {
      socketId: socket.id,
      sessionId,
      connectedAt: Date.now(),
      lastPing: Date.now(),
      rooms: [],
      userId: socket.data.userId
    };

    // Store connection state
    this.connections.set(socket.id, connectionState);
    socket.data.sessionId = sessionId;
    socket.data.connectedAt = Date.now();
    socket.data.rooms = new Set();

    // Update metrics
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    // Send connection confirmation
    const payload: ConnectionPayload = {
      socketId: socket.id,
      sessionId,
      timestamp: Date.now(),
      server: {
        version: '1.0.0',
        uptime: Date.now() - this.metrics.uptime
      }
    };
    socket.emit('connection:established', payload);

    console.log(`[WS] New connection: ${socket.id} (namespace: ${namespace}, session: ${sessionId})`);

    // Setup event handlers
    this.setupSocketHandlers(socket);
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(socket: TypedSocket, reason: string): void {
    const connectionState = this.connections.get(socket.id);

    if (connectionState) {
      // Leave all rooms
      connectionState.rooms.forEach(room => {
        socket.leave(room);
      });

      // Remove from connections
      this.connections.delete(socket.id);
      this.metrics.activeConnections--;

      const duration = Date.now() - connectionState.connectedAt;
      console.log(`[WS] Disconnected: ${socket.id} (reason: ${reason}, duration: ${duration}ms)`);
    }

    // Clear socket data
    if (socket.data.rooms) {
      socket.data.rooms.clear();
    }
  }

  /**
   * Handle reconnection
   */
  handleReconnection(socket: TypedSocket, previousSessionId?: string): void {
    this.metrics.reconnections++;

    console.log(`[WS] Reconnection: ${socket.id} (previous session: ${previousSessionId || 'unknown'})`);

    // If we have the previous session, we could restore room subscriptions
    if (previousSessionId) {
      // Future enhancement: restore previous room subscriptions
    }
  }

  /**
   * Join a room
   */
  async joinRoom(socket: TypedSocket, room: string, roomType?: RoomType): Promise<void> {
    try {
      await socket.join(room);

      // Update connection state
      const connectionState = this.connections.get(socket.id);
      if (connectionState) {
        connectionState.rooms.push(room);
      }

      // Update socket data
      socket.data.rooms.add(room);

      console.log(`[WS] Socket ${socket.id} joined room: ${room} (type: ${roomType || 'custom'})`);

      // Update room count
      this.updateRoomCount();
    } catch (error) {
      console.error(`[WS] Error joining room ${room}:`, error);
      this.emitError(socket, 'ROOM_JOIN_ERROR', `Failed to join room: ${room}`);
    }
  }

  /**
   * Leave a room
   */
  async leaveRoom(socket: TypedSocket, room: string): Promise<void> {
    try {
      await socket.leave(room);

      // Update connection state
      const connectionState = this.connections.get(socket.id);
      if (connectionState) {
        connectionState.rooms = connectionState.rooms.filter(r => r !== room);
      }

      // Update socket data
      socket.data.rooms.delete(room);

      console.log(`[WS] Socket ${socket.id} left room: ${room}`);

      // Update room count
      this.updateRoomCount();
    } catch (error) {
      console.error(`[WS] Error leaving room ${room}:`, error);
    }
  }

  /**
   * Broadcast to a room
   */
  broadcastToRoom(room: string, event: string, data: unknown): void {
    this.io.to(room).emit(event, data);
    this.metrics.messagesSent++;

    console.log(`[WS] Broadcast to room '${room}': ${event}`);
  }

  /**
   * Broadcast to a namespace
   */
  broadcastToNamespace(namespace: NamespaceType, event: string, data: unknown): void {
    this.io.of(namespace).emit(event, data);
    this.metrics.messagesSent++;

    console.log(`[WS] Broadcast to namespace '${namespace}': ${event}`);
  }

  /**
   * Send to specific socket
   */
  sendToSocket(socketId: string, event: string, data: unknown): void {
    this.io.to(socketId).emit(event, data);
    this.metrics.messagesSent++;
  }

  /**
   * Get active connections count
   */
  getActiveConnections(): number {
    return this.connections.size;
  }

  /**
   * Get connections by room
   */
  getConnectionsByRoom(room: string): ConnectionState[] {
    return Array.from(this.connections.values()).filter(conn =>
      conn.rooms.includes(room)
    );
  }

  /**
   * Get server metrics
   */
  getMetrics(): ServerMetrics {
    return {
      ...this.metrics,
      activeConnections: this.connections.size,
      uptime: Date.now() - this.metrics.uptime
    };
  }

  /**
   * Cleanup stale connections
   */
  cleanupStaleConnections(maxAge: number = 3600000): void {
    const now = Date.now();
    let cleaned = 0;

    this.connections.forEach((state, socketId) => {
      if (now - state.lastPing > maxAge) {
        this.connections.delete(socketId);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`[WS] Cleaned up ${cleaned} stale connections`);
    }
  }

  /**
   * Setup socket event handlers
   */
  private setupSocketHandlers(socket: TypedSocket): void {
    // Ping/Pong for health check
    socket.on('ping', () => {
      socket.emit('pong', Date.now());
      this.updateLastPing(socket.id);
    });

    // Room management
    socket.on('room:join', async (room: string) => {
      await this.joinRoom(socket, room);
      this.metrics.messagesReceived++;
    });

    socket.on('room:leave', async (room: string) => {
      await this.leaveRoom(socket, room);
      this.metrics.messagesReceived++;
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`[WS] Socket error on ${socket.id}:`, error);
      this.metrics.errors++;
    });

    // Disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });
  }

  /**
   * Update last ping timestamp
   */
  private updateLastPing(socketId: string): void {
    const connectionState = this.connections.get(socketId);
    if (connectionState) {
      connectionState.lastPing = Date.now();
    }
  }

  /**
   * Update room count metric
   */
  private updateRoomCount(): void {
    const rooms = new Set<string>();
    this.connections.forEach(state => {
      state.rooms.forEach(room => rooms.add(room));
    });
    this.metrics.totalRooms = rooms.size;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit error to socket
   */
  private emitError(socket: TypedSocket, code: string, message: string, details?: unknown): void {
    const payload: ErrorPayload = {
      code,
      message,
      timestamp: Date.now(),
      details
    };
    socket.emit('connection:error', payload);
    this.metrics.errors++;
  }

  /**
   * Setup periodic metrics tracking
   */
  private setupMetricsTracking(): void {
    // Log metrics every 5 minutes
    setInterval(() => {
      console.log('[WS] Server Metrics:', this.getMetrics());
    }, 300000);

    // Cleanup stale connections every hour
    setInterval(() => {
      this.cleanupStaleConnections();
    }, 3600000);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('[WS] Starting graceful shutdown...');

    // Notify all clients
    this.io.emit('connection:error', {
      code: 'SERVER_SHUTDOWN',
      message: 'Server is shutting down',
      timestamp: Date.now()
    } as ErrorPayload);

    // Close all connections
    const sockets = await this.io.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    this.connections.clear();
    console.log('[WS] Shutdown complete');
  }
}
