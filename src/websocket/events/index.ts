import { Server, Socket } from 'socket.io';
import {
  LeaderboardEvents,
  LeaderboardEventType,
} from './leaderboardEvents';
import { MatchEvents, MatchEventType, MatchState } from './matchEvents';
import { LeaderboardService } from '../../services/LeaderboardService';

/**
 * All event types exported for client usage
 */
export { LeaderboardEventType, MatchEventType, MatchState };

/**
 * Event room types
 */
export enum EventRoom {
  GLOBAL = 'global',
  COUNTRY = 'country',
  SESSION = 'session',
}

/**
 * Main event handler that routes all WebSocket events
 */
export class EventHandler {
  private leaderboardEvents: LeaderboardEvents;
  private matchEvents: MatchEvents;
  private cleanupIntervals: NodeJS.Timeout[] = [];

  constructor(leaderboardService: LeaderboardService) {
    this.leaderboardEvents = new LeaderboardEvents(leaderboardService);
    this.matchEvents = new MatchEvents();
  }

  /**
   * Initialize all event handlers
   */
  async initialize(io: Server): Promise<void> {
    // Initialize event handlers
    await this.leaderboardEvents.initialize(io);
    await this.matchEvents.initialize(io);

    // Set up room management
    this.setupRoomManagement(io);

    // Start periodic leaderboard updates
    this.startPeriodicUpdates(io);

    // Start cleanup tasks
    const throttleCleanup = this.leaderboardEvents.startThrottleCleanup();
    this.cleanupIntervals.push(throttleCleanup);
  }

  /**
   * Set up room management for clients
   */
  private setupRoomManagement(io: Server): void {
    io.on('connection', (socket: Socket) => {
      // Join global room by default
      socket.join(EventRoom.GLOBAL);

      // Handle custom room joins
      socket.on('joinRoom', (data: { room: string; metadata?: unknown }) => {
        socket.join(data.room);
        socket.emit('roomJoined', { room: data.room });
      });

      // Handle room leaves
      socket.on('leaveRoom', (data: { room: string }) => {
        socket.leave(data.room);
        socket.emit('roomLeft', { room: data.room });
      });

      // Handle country-specific room
      socket.on('joinCountry', (data: { country: string }) => {
        const countryRoom = `country:${data.country}`;
        socket.join(countryRoom);
        socket.emit('countryJoined', { country: data.country });
      });

      // Handle player-specific room
      socket.on('joinPlayer', (data: { playerId: string }) => {
        const playerRoom = `player:${data.playerId}`;
        socket.join(playerRoom);
        socket.emit('playerJoined', { playerId: data.playerId });
      });

      // Handle match room
      socket.on('joinMatch', (data: { matchId: string }) => {
        const matchRoom = MatchEvents.getMatchRoom(data.matchId);
        socket.join(matchRoom);
        socket.emit('matchJoined', { matchId: data.matchId });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        // Cleanup handled by Socket.IO automatically
      });
    });
  }

  /**
   * Start periodic leaderboard updates
   */
  private startPeriodicUpdates(io: Server): void {
    // Update global leaderboard every 10 seconds
    const globalInterval = setInterval(() => {
      this.leaderboardEvents
        .handleLeaderboardUpdate(io, 50, 'global')
        .catch((error) => {
          console.error('Error updating global leaderboard:', error);
        });
    }, 10000);

    this.cleanupIntervals.push(globalInterval);
  }

  /**
   * Get leaderboard events handler
   */
  getLeaderboardEvents(): LeaderboardEvents {
    return this.leaderboardEvents;
  }

  /**
   * Get match events handler
   */
  getMatchEvents(): MatchEvents {
    return this.matchEvents;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    // Clear all intervals
    for (const interval of this.cleanupIntervals) {
      clearInterval(interval);
    }
    this.cleanupIntervals = [];

    // Clean up match events
    this.matchEvents.cleanup();
  }
}

/**
 * Helper functions for event emission
 */
export class EventEmitter {
  private eventHandler: EventHandler;
  private io: Server;

  constructor(eventHandler: EventHandler, io: Server) {
    this.eventHandler = eventHandler;
    this.io = io;
  }

  /**
   * Emit rank change event
   */
  async emitRankChange(
    playerId: string,
    oldRank: number,
    newRank: number,
    rating: number,
    username: string
  ): Promise<void> {
    await this.eventHandler
      .getLeaderboardEvents()
      .handleRankChange(this.io, playerId, oldRank, newRank, rating, username);
  }

  /**
   * Emit leaderboard update
   */
  async emitLeaderboardUpdate(
    topN?: number,
    scope?: 'global' | 'country'
  ): Promise<void> {
    await this.eventHandler
      .getLeaderboardEvents()
      .handleLeaderboardUpdate(this.io, topN, scope);
  }

  /**
   * Emit player joined
   */
  async emitPlayerJoined(
    playerId: string,
    username: string,
    rating: number,
    rank: number
  ): Promise<void> {
    await this.eventHandler
      .getLeaderboardEvents()
      .handlePlayerJoined(this.io, playerId, username, rating, rank);
  }

  /**
   * Emit player left
   */
  async emitPlayerLeft(
    playerId: string,
    username: string,
    rating: number,
    rank: number
  ): Promise<void> {
    await this.eventHandler
      .getLeaderboardEvents()
      .handlePlayerLeft(this.io, playerId, username, rating, rank);
  }

  /**
   * Emit match started
   */
  async emitMatchStarted(
    matchId: string,
    player1: { id: string; username: string; rating: number },
    player2: { id: string; username: string; rating: number },
    estimatedDuration?: number
  ): Promise<void> {
    await this.eventHandler
      .getMatchEvents()
      .handleMatchStarted(this.io, matchId, player1, player2, estimatedDuration);
  }

  /**
   * Emit match updated
   */
  async emitMatchUpdated(
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
    await this.eventHandler
      .getMatchEvents()
      .handleMatchUpdated(this.io, matchId, state, options);
  }

  /**
   * Emit match completed
   */
  async emitMatchCompleted(
    matchId: string,
    winnerId: string,
    loserId: string,
    winnerUsername: string,
    loserUsername: string,
    finalScore: { winnerScore: number; loserScore: number },
    duration: number,
    matchType?: string
  ): Promise<void> {
    await this.eventHandler
      .getMatchEvents()
      .handleMatchCompleted(
        this.io,
        matchId,
        winnerId,
        loserId,
        winnerUsername,
        loserUsername,
        finalScore,
        duration,
        matchType
      );
  }

  /**
   * Emit player action
   */
  async emitPlayerAction(
    matchId: string,
    playerId: string,
    username: string,
    action: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.eventHandler
      .getMatchEvents()
      .handlePlayerAction(this.io, matchId, playerId, username, action, data);
  }

  /**
   * Emit ELO update
   */
  async emitEloUpdate(
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
    await this.eventHandler
      .getMatchEvents()
      .handleEloUpdate(this.io, matchId, players);
  }
}

/**
 * Create and initialize event system
 */
export async function createEventSystem(
  io: Server,
  leaderboardService: LeaderboardService
): Promise<{ eventHandler: EventHandler; eventEmitter: EventEmitter }> {
  const eventHandler = new EventHandler(leaderboardService);
  await eventHandler.initialize(io);

  const eventEmitter = new EventEmitter(eventHandler, io);

  return { eventHandler, eventEmitter };
}
