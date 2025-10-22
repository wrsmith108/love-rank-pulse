import { Server, Socket } from 'socket.io';
import { LeaderboardService } from '../../services/LeaderboardService';
import { redisClient } from '../../utils/redisClient';

/**
 * Leaderboard event types
 */
export enum LeaderboardEventType {
  RANK_CHANGE = 'leaderboard:rankChange',
  LEADERBOARD_UPDATE = 'leaderboard:update',
  PLAYER_JOINED = 'leaderboard:playerJoined',
  PLAYER_LEFT = 'leaderboard:playerLeft',
}

/**
 * Leaderboard entry for efficient transmission
 */
interface LeaderboardEntry {
  playerId: string;
  username: string;
  rank: number;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;
}

/**
 * Rank change event payload
 */
interface RankChangePayload {
  playerId: string;
  username: string;
  oldRank: number;
  newRank: number;
  rating: number;
  change: number;
}

/**
 * Leaderboard update payload (diff-based)
 */
interface LeaderboardUpdatePayload {
  topN: number;
  entries: LeaderboardEntry[];
  changes: Array<{
    playerId: string;
    previousRank?: number;
    currentRank: number;
    moved: 'up' | 'down' | 'new' | 'unchanged';
  }>;
  timestamp: number;
}

/**
 * Player joined/left payload
 */
interface PlayerActivityPayload {
  playerId: string;
  username: string;
  rating: number;
  rank: number;
  timestamp: number;
}

/**
 * Leaderboard snapshot for diff calculation
 */
interface LeaderboardSnapshot {
  entries: Map<string, { rank: number; rating: number }>;
  timestamp: number;
}

/**
 * Leaderboard events handler
 */
export class LeaderboardEvents {
  private leaderboardService: LeaderboardService;
  private lastSnapshot: LeaderboardSnapshot | null = null;
  private updateThrottle: Map<string, number> = new Map();
  private readonly THROTTLE_MS = 1000; // 1 second
  private readonly MAX_TOP_N = 100;
  private readonly SNAPSHOT_KEY = 'leaderboard:snapshot';

  constructor(leaderboardService: LeaderboardService) {
    this.leaderboardService = leaderboardService;
  }

  /**
   * Initialize leaderboard events
   */
  async initialize(io: Server): Promise<void> {
    // Subscribe to Redis pub/sub for multi-server support
    const subscriber = redisClient.duplicate();
    await subscriber.connect();

    subscriber.subscribe('leaderboard:events', (message) => {
      try {
        const event = JSON.parse(message);
        this.broadcastEvent(io, event.type, event.payload, event.room);
      } catch (error) {
        console.error('Error processing leaderboard event:', error);
      }
    });

    // Load initial snapshot
    await this.loadSnapshot();
  }

  /**
   * Handle rank change event
   */
  async handleRankChange(
    io: Server,
    playerId: string,
    oldRank: number,
    newRank: number,
    rating: number,
    username: string
  ): Promise<void> {
    // Throttle updates per player
    if (!this.shouldUpdate(playerId)) {
      return;
    }

    const payload: RankChangePayload = {
      playerId,
      username,
      oldRank,
      newRank,
      rating,
      change: oldRank - newRank,
    };

    await this.publishEvent(
      io,
      LeaderboardEventType.RANK_CHANGE,
      payload,
      'global'
    );

    // Update snapshot
    await this.updateSnapshotEntry(playerId, newRank, rating);
  }

  /**
   * Handle leaderboard update (top N players with diff)
   */
  async handleLeaderboardUpdate(
    io: Server,
    topN: number = 50,
    scope?: 'global' | 'country'
  ): Promise<void> {
    // Throttle global updates
    const throttleKey = `update:${scope || 'global'}`;
    if (!this.shouldUpdate(throttleKey)) {
      return;
    }

    const clampedTopN = Math.min(topN, this.MAX_TOP_N);

    // Fetch current leaderboard
    const leaderboard = await this.leaderboardService.getLeaderboard({
      limit: clampedTopN,
      offset: 0,
    });

    const currentEntries = leaderboard.players.map((player, index) => ({
      playerId: player.id,
      username: player.username,
      rank: index + 1,
      rating: player.rating,
      wins: player.wins,
      losses: player.losses,
      winRate:
        player.wins + player.losses > 0
          ? player.wins / (player.wins + player.losses)
          : 0,
    }));

    // Calculate diff
    const changes = this.calculateDiff(currentEntries);

    const payload: LeaderboardUpdatePayload = {
      topN: clampedTopN,
      entries: currentEntries,
      changes,
      timestamp: Date.now(),
    };

    // Publish event
    await this.publishEvent(
      io,
      LeaderboardEventType.LEADERBOARD_UPDATE,
      payload,
      scope || 'global'
    );

    // Update snapshot
    await this.saveSnapshot(currentEntries);
  }

  /**
   * Handle player joined event
   */
  async handlePlayerJoined(
    io: Server,
    playerId: string,
    username: string,
    rating: number,
    rank: number
  ): Promise<void> {
    const payload: PlayerActivityPayload = {
      playerId,
      username,
      rating,
      rank,
      timestamp: Date.now(),
    };

    await this.publishEvent(
      io,
      LeaderboardEventType.PLAYER_JOINED,
      payload,
      'global'
    );
  }

  /**
   * Handle player left event
   */
  async handlePlayerLeft(
    io: Server,
    playerId: string,
    username: string,
    rating: number,
    rank: number
  ): Promise<void> {
    const payload: PlayerActivityPayload = {
      playerId,
      username,
      rating,
      rank,
      timestamp: Date.now(),
    };

    await this.publishEvent(
      io,
      LeaderboardEventType.PLAYER_LEFT,
      payload,
      'global'
    );
  }

  /**
   * Calculate diff between current and previous leaderboard
   */
  private calculateDiff(
    currentEntries: LeaderboardEntry[]
  ): LeaderboardUpdatePayload['changes'] {
    const changes: LeaderboardUpdatePayload['changes'] = [];

    if (!this.lastSnapshot) {
      // First update - all are new
      return currentEntries.map((entry) => ({
        playerId: entry.playerId,
        currentRank: entry.rank,
        moved: 'new' as const,
      }));
    }

    for (const entry of currentEntries) {
      const previous = this.lastSnapshot.entries.get(entry.playerId);

      if (!previous) {
        changes.push({
          playerId: entry.playerId,
          currentRank: entry.rank,
          moved: 'new',
        });
      } else if (previous.rank !== entry.rank) {
        changes.push({
          playerId: entry.playerId,
          previousRank: previous.rank,
          currentRank: entry.rank,
          moved: entry.rank < previous.rank ? 'up' : 'down',
        });
      } else {
        // Only include unchanged if rating changed
        if (previous.rating !== entry.rating) {
          changes.push({
            playerId: entry.playerId,
            previousRank: previous.rank,
            currentRank: entry.rank,
            moved: 'unchanged',
          });
        }
      }
    }

    return changes;
  }

  /**
   * Check if update should be sent (throttling)
   */
  private shouldUpdate(key: string): boolean {
    const now = Date.now();
    const lastUpdate = this.updateThrottle.get(key) || 0;

    if (now - lastUpdate >= this.THROTTLE_MS) {
      this.updateThrottle.set(key, now);
      return true;
    }

    return false;
  }

  /**
   * Publish event to Redis for multi-server broadcasting
   */
  private async publishEvent(
    io: Server,
    type: LeaderboardEventType,
    payload: unknown,
    room: string
  ): Promise<void> {
    const event = { type, payload, room };

    // Publish to Redis
    await redisClient.publish('leaderboard:events', JSON.stringify(event));

    // Also broadcast locally
    this.broadcastEvent(io, type, payload, room);
  }

  /**
   * Broadcast event to Socket.IO room
   */
  private broadcastEvent(
    io: Server,
    type: LeaderboardEventType,
    payload: unknown,
    room: string
  ): void {
    io.to(room).emit(type, payload);
  }

  /**
   * Load snapshot from Redis
   */
  private async loadSnapshot(): Promise<void> {
    try {
      const data = await redisClient.get(this.SNAPSHOT_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.lastSnapshot = {
          entries: new Map(Object.entries(parsed.entries)),
          timestamp: parsed.timestamp,
        };
      }
    } catch (error) {
      console.error('Error loading leaderboard snapshot:', error);
      this.lastSnapshot = null;
    }
  }

  /**
   * Save snapshot to Redis
   */
  private async saveSnapshot(entries: LeaderboardEntry[]): Promise<void> {
    const entriesMap = new Map<string, { rank: number; rating: number }>();

    for (const entry of entries) {
      entriesMap.set(entry.playerId, {
        rank: entry.rank,
        rating: entry.rating,
      });
    }

    this.lastSnapshot = {
      entries: entriesMap,
      timestamp: Date.now(),
    };

    try {
      const data = {
        entries: Object.fromEntries(entriesMap),
        timestamp: this.lastSnapshot.timestamp,
      };
      await redisClient.set(
        this.SNAPSHOT_KEY,
        JSON.stringify(data),
        { EX: 3600 } // 1 hour expiry
      );
    } catch (error) {
      console.error('Error saving leaderboard snapshot:', error);
    }
  }

  /**
   * Update single entry in snapshot
   */
  private async updateSnapshotEntry(
    playerId: string,
    rank: number,
    rating: number
  ): Promise<void> {
    if (!this.lastSnapshot) {
      this.lastSnapshot = {
        entries: new Map(),
        timestamp: Date.now(),
      };
    }

    this.lastSnapshot.entries.set(playerId, { rank, rating });
    this.lastSnapshot.timestamp = Date.now();
  }

  /**
   * Clean up throttle map periodically
   */
  startThrottleCleanup(): NodeJS.Timeout {
    return setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.updateThrottle.entries()) {
        if (now - timestamp > this.THROTTLE_MS * 10) {
          this.updateThrottle.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}
