/**
 * Redis Pub/Sub Channel Definitions
 *
 * Centralized channel naming and event type definitions
 * for multi-server WebSocket coordination.
 *
 * @module websocket/redis/channels
 */

/**
 * Redis channel names for different event types
 */
export const REDIS_CHANNELS = {
  /**
   * Leaderboard updates - global ranking changes
   * Published when: Player ratings change, rankings shift
   */
  LEADERBOARD_UPDATES: 'leaderboard:updates',

  /**
   * Match events - game state changes
   * Published when: Matches start, complete, or update
   */
  MATCH_EVENTS: 'match:events',

  /**
   * Player notifications - user-specific events
   * Published when: Player-specific actions occur
   */
  PLAYER_NOTIFICATIONS: 'player:notifications',

  /**
   * System events - server coordination
   * Published when: Server status changes, health checks
   */
  SYSTEM_EVENTS: 'system:events',
} as const;

/**
 * Type-safe channel names
 */
export type RedisChannel = typeof REDIS_CHANNELS[keyof typeof REDIS_CHANNELS];

/**
 * Leaderboard update event payload
 */
export interface LeaderboardUpdateEvent {
  type: 'leaderboard_update';
  timestamp: number;
  data: {
    playerId?: string;
    affectedPlayers?: string[];
    rankChanges?: Array<{
      playerId: string;
      oldRank: number;
      newRank: number;
      ratingChange: number;
    }>;
    fullRefresh?: boolean;
  };
  serverId: string;
}

/**
 * Match event payload
 */
export interface MatchEvent {
  type: 'match_created' | 'match_started' | 'match_completed' | 'match_updated';
  timestamp: number;
  data: {
    matchId: string;
    player1Id: string;
    player2Id: string;
    winnerId?: string;
    player1RatingChange?: number;
    player2RatingChange?: number;
    status?: 'pending' | 'completed';
  };
  serverId: string;
}

/**
 * Player notification event payload
 */
export interface PlayerNotificationEvent {
  type: 'rating_changed' | 'match_invite' | 'achievement_unlocked' | 'rank_changed';
  timestamp: number;
  data: {
    playerId: string;
    message: string;
    metadata?: Record<string, any>;
  };
  serverId: string;
}

/**
 * System event payload
 */
export interface SystemEvent {
  type: 'server_started' | 'server_stopped' | 'health_check';
  timestamp: number;
  data: {
    serverId: string;
    status: 'online' | 'offline' | 'degraded';
    metadata?: Record<string, any>;
  };
  serverId: string;
}

/**
 * Union type of all possible event payloads
 */
export type RedisEventPayload =
  | LeaderboardUpdateEvent
  | MatchEvent
  | PlayerNotificationEvent
  | SystemEvent;

/**
 * Channel to event type mapping for type safety
 */
export interface ChannelEventMap {
  [REDIS_CHANNELS.LEADERBOARD_UPDATES]: LeaderboardUpdateEvent;
  [REDIS_CHANNELS.MATCH_EVENTS]: MatchEvent;
  [REDIS_CHANNELS.PLAYER_NOTIFICATIONS]: PlayerNotificationEvent;
  [REDIS_CHANNELS.SYSTEM_EVENTS]: SystemEvent;
}

/**
 * Get channel pattern for subscription (supports wildcards)
 */
export function getChannelPattern(channel: RedisChannel): string {
  return channel;
}

/**
 * Extract server ID from event payload
 */
export function extractServerId(event: RedisEventPayload): string {
  return event.serverId;
}

/**
 * Create a unique server ID
 */
export function createServerId(): string {
  return `server_${process.pid}_${Date.now()}`;
}

/**
 * Validate event payload structure
 */
export function isValidEventPayload(payload: any): payload is RedisEventPayload {
  return (
    payload &&
    typeof payload === 'object' &&
    typeof payload.type === 'string' &&
    typeof payload.timestamp === 'number' &&
    typeof payload.serverId === 'string' &&
    payload.data !== undefined
  );
}
