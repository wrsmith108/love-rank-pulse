import { Server, Socket } from 'socket.io';
import { redisClient } from '../../utils/redisClient';

/**
 * Match event types
 */
export enum MatchEventType {
  MATCH_STARTED = 'match:started',
  MATCH_UPDATED = 'match:updated',
  MATCH_COMPLETED = 'match:completed',
  PLAYER_ACTION = 'match:playerAction',
  ELO_UPDATE = 'match:eloUpdate',
}

/**
 * Match state
 */
export enum MatchState {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Match started event payload
 */
interface MatchStartedPayload {
  matchId: string;
  player1: {
    id: string;
    username: string;
    rating: number;
  };
  player2: {
    id: string;
    username: string;
    rating: number;
  };
  startedAt: number;
  estimatedDuration?: number;
}

/**
 * Match updated event payload (live score/state changes)
 */
interface MatchUpdatedPayload {
  matchId: string;
  state: MatchState;
  score?: {
    player1Score: number;
    player2Score: number;
  };
  duration?: number;
  currentRound?: number;
  totalRounds?: number;
  lastAction?: {
    playerId: string;
    action: string;
    timestamp: number;
  };
}

/**
 * Match completed event payload
 */
interface MatchCompletedPayload {
  matchId: string;
  winnerId: string;
  loserId: string;
  winnerUsername: string;
  loserUsername: string;
  finalScore: {
    winnerScore: number;
    loserScore: number;
  };
  duration: number;
  completedAt: number;
  matchType?: string;
}

/**
 * Player action event payload
 */
interface PlayerActionPayload {
  matchId: string;
  playerId: string;
  username: string;
  action: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

/**
 * ELO update event payload
 */
interface EloUpdatePayload {
  matchId: string;
  players: Array<{
    playerId: string;
    username: string;
    oldRating: number;
    newRating: number;
    change: number;
    oldRank?: number;
    newRank?: number;
  }>;
  timestamp: number;
}

/**
 * Message batch for high-frequency updates
 */
interface MessageBatch {
  events: Array<{
    type: MatchEventType;
    payload: unknown;
  }>;
  timestamp: number;
}

/**
 * Match events handler
 */
export class MatchEvents {
  private messageBatches: Map<string, MessageBatch> = new Map();
  private readonly BATCH_INTERVAL_MS = 100; // Batch every 100ms
  private readonly MAX_BATCH_SIZE = 50;
  private batchInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize match events
   */
  async initialize(io: Server): Promise<void> {
    // Subscribe to Redis pub/sub for multi-server support
    const subscriber = redisClient.duplicate();
    await subscriber.connect();

    subscriber.subscribe('match:events', (message) => {
      try {
        const event = JSON.parse(message);
        this.broadcastEvent(io, event.type, event.payload, event.room);
      } catch (error) {
        console.error('Error processing match event:', error);
      }
    });

    // Start message batching processor
    this.startBatchProcessor(io);
  }

  /**
   * Handle match started event
   */
  async handleMatchStarted(
    io: Server,
    matchId: string,
    player1: { id: string; username: string; rating: number },
    player2: { id: string; username: string; rating: number },
    estimatedDuration?: number
  ): Promise<void> {
    const payload: MatchStartedPayload = {
      matchId,
      player1,
      player2,
      startedAt: Date.now(),
      estimatedDuration,
    };

    await this.publishEvent(
      io,
      MatchEventType.MATCH_STARTED,
      payload,
      `match:${matchId}`
    );

    // Also broadcast to global room for spectators
    await this.publishEvent(
      io,
      MatchEventType.MATCH_STARTED,
      payload,
      'global'
    );
  }

  /**
   * Handle match updated event (live score/state changes)
   */
  async handleMatchUpdated(
    io: Server,
    matchId: string,
    state: MatchState,
    options?: {
      score?: { player1Score: number; player2Score: number };
      duration?: number;
      currentRound?: number;
      totalRounds?: number;
      lastAction?: {
        playerId: string;
        action: string;
        timestamp: number;
      };
    }
  ): Promise<void> {
    const payload: MatchUpdatedPayload = {
      matchId,
      state,
      ...options,
    };

    // Add to batch for high-frequency updates
    this.addToBatch(
      `match:${matchId}`,
      MatchEventType.MATCH_UPDATED,
      payload
    );
  }

  /**
   * Handle match completed event
   */
  async handleMatchCompleted(
    io: Server,
    matchId: string,
    winnerId: string,
    loserId: string,
    winnerUsername: string,
    loserUsername: string,
    finalScore: { winnerScore: number; loserScore: number },
    duration: number,
    matchType?: string
  ): Promise<void> {
    const payload: MatchCompletedPayload = {
      matchId,
      winnerId,
      loserId,
      winnerUsername,
      loserUsername,
      finalScore,
      duration,
      completedAt: Date.now(),
      matchType,
    };

    // Flush any pending batches for this match
    await this.flushBatch(io, `match:${matchId}`);

    await this.publishEvent(
      io,
      MatchEventType.MATCH_COMPLETED,
      payload,
      `match:${matchId}`
    );

    // Also broadcast to global room
    await this.publishEvent(
      io,
      MatchEventType.MATCH_COMPLETED,
      payload,
      'global'
    );
  }

  /**
   * Handle player action event (real-time actions)
   */
  async handlePlayerAction(
    io: Server,
    matchId: string,
    playerId: string,
    username: string,
    action: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const payload: PlayerActionPayload = {
      matchId,
      playerId,
      username,
      action,
      data,
      timestamp: Date.now(),
    };

    // Add to batch for high-frequency updates
    this.addToBatch(
      `match:${matchId}`,
      MatchEventType.PLAYER_ACTION,
      payload
    );
  }

  /**
   * Handle ELO update event (broadcast after match completion)
   */
  async handleEloUpdate(
    io: Server,
    matchId: string,
    players: Array<{
      playerId: string;
      username: string;
      oldRating: number;
      newRating: number;
      change: number;
      oldRank?: number;
      newRank?: number;
    }>
  ): Promise<void> {
    const payload: EloUpdatePayload = {
      matchId,
      players,
      timestamp: Date.now(),
    };

    // Broadcast to match room
    await this.publishEvent(
      io,
      MatchEventType.ELO_UPDATE,
      payload,
      `match:${matchId}`
    );

    // Broadcast to each player's personal room
    for (const player of players) {
      await this.publishEvent(
        io,
        MatchEventType.ELO_UPDATE,
        payload,
        `player:${player.playerId}`
      );
    }

    // Broadcast to global room
    await this.publishEvent(io, MatchEventType.ELO_UPDATE, payload, 'global');
  }

  /**
   * Add event to message batch
   */
  private addToBatch(
    room: string,
    type: MatchEventType,
    payload: unknown
  ): void {
    let batch = this.messageBatches.get(room);

    if (!batch) {
      batch = {
        events: [],
        timestamp: Date.now(),
      };
      this.messageBatches.set(room, batch);
    }

    batch.events.push({ type, payload });

    // Flush immediately if batch is full
    if (batch.events.length >= this.MAX_BATCH_SIZE) {
      this.flushBatchSync(room, batch);
    }
  }

  /**
   * Start batch processor for periodic flushing
   */
  private startBatchProcessor(io: Server): void {
    this.batchInterval = setInterval(() => {
      for (const [room, batch] of this.messageBatches.entries()) {
        const age = Date.now() - batch.timestamp;

        // Flush batches older than interval
        if (age >= this.BATCH_INTERVAL_MS) {
          this.flushBatchSync(room, batch);
        }
      }
    }, this.BATCH_INTERVAL_MS);
  }

  /**
   * Flush batch synchronously (called by interval)
   */
  private flushBatchSync(room: string, batch: MessageBatch): void {
    if (batch.events.length === 0) {
      return;
    }

    // Publish batched events
    for (const event of batch.events) {
      redisClient
        .publish(
          'match:events',
          JSON.stringify({ type: event.type, payload: event.payload, room })
        )
        .catch((error) => {
          console.error('Error publishing batched event:', error);
        });
    }

    this.messageBatches.delete(room);
  }

  /**
   * Flush batch asynchronously (called manually)
   */
  private async flushBatch(io: Server, room: string): Promise<void> {
    const batch = this.messageBatches.get(room);

    if (!batch || batch.events.length === 0) {
      return;
    }

    // Publish all batched events
    for (const event of batch.events) {
      await this.publishEvent(io, event.type, event.payload, room);
    }

    this.messageBatches.delete(room);
  }

  /**
   * Publish event to Redis for multi-server broadcasting
   */
  private async publishEvent(
    io: Server,
    type: MatchEventType,
    payload: unknown,
    room: string
  ): Promise<void> {
    const event = { type, payload, room };

    // Compress large payloads
    const compressed = this.compressPayload(payload);

    // Publish to Redis
    await redisClient.publish(
      'match:events',
      JSON.stringify({ type, payload: compressed, room })
    );

    // Also broadcast locally
    this.broadcastEvent(io, type, compressed, room);
  }

  /**
   * Broadcast event to Socket.IO room
   */
  private broadcastEvent(
    io: Server,
    type: MatchEventType,
    payload: unknown,
    room: string
  ): void {
    io.to(room).emit(type, payload);
  }

  /**
   * Compress payload for large messages
   */
  private compressPayload(payload: unknown): unknown {
    // For now, just return payload
    // In production, implement actual compression (e.g., zlib)
    // Only compress if payload size > threshold
    const serialized = JSON.stringify(payload);

    if (serialized.length > 1024) {
      // Implement compression here if needed
      // For example: pako.deflate(serialized)
      return payload;
    }

    return payload;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
    }

    // Flush all remaining batches
    for (const [room, batch] of this.messageBatches.entries()) {
      this.flushBatchSync(room, batch);
    }

    this.messageBatches.clear();
  }

  /**
   * Get match room name
   */
  static getMatchRoom(matchId: string): string {
    return `match:${matchId}`;
  }

  /**
   * Get player room name
   */
  static getPlayerRoom(playerId: string): string {
    return `player:${playerId}`;
  }
}
