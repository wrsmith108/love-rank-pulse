/**
 * Session Management
 *
 * Handles user sessions with Redis for distributed session storage,
 * token blacklisting, and session tracking.
 */

import { RedisClientType } from 'redis';
import { getRedisClient } from '../utils/redisClient';
import { JWTPayload } from './auth';

/**
 * Session data interface
 */
export interface SessionData {
  userId: string;
  username: string;
  email: string;
  createdAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Session configuration
 */
const SESSION_CONFIG = {
  SESSION_TTL: 7 * 24 * 60 * 60, // 7 days in seconds
  ACTIVITY_UPDATE_INTERVAL: 5 * 60, // Update last activity every 5 minutes
  MAX_SESSIONS_PER_USER: 5, // Maximum concurrent sessions per user
  BLACKLIST_TTL: 7 * 24 * 60 * 60, // 7 days in seconds
};

/**
 * Session Manager class
 */
export class SessionManager {
  private redis: RedisClientType | null = null;

  /**
   * Initialize Redis connection
   */
  private async ensureRedis(): Promise<RedisClientType> {
    if (!this.redis) {
      this.redis = await getRedisClient();
    }
    return this.redis;
  }

  /**
   * Generate session key
   */
  private getSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Generate user sessions key (list of session IDs for a user)
   */
  private getUserSessionsKey(userId: string): string {
    return `user:${userId}:sessions`;
  }

  /**
   * Generate blacklist key
   */
  private getBlacklistKey(token: string): string {
    return `blacklist:${token}`;
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string,
    payload: JWTPayload,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<SessionData> {
    const redis = await this.ensureRedis();
    const now = new Date();

    const sessionData: SessionData = {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      createdAt: now,
      lastActivity: now,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
    };

    // Store session data
    const sessionKey = this.getSessionKey(sessionId);
    await redis.setEx(
      sessionKey,
      SESSION_CONFIG.SESSION_TTL,
      JSON.stringify(sessionData)
    );

    // Add session to user's session list
    const userSessionsKey = this.getUserSessionsKey(payload.userId);
    await redis.sAdd(userSessionsKey, sessionId);
    await redis.expire(userSessionsKey, SESSION_CONFIG.SESSION_TTL);

    // Enforce max sessions per user
    await this.enforceMaxSessions(payload.userId);

    console.log(`[SessionManager] Created session ${sessionId} for user ${payload.userId}`);

    return sessionData;
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const redis = await this.ensureRedis();
      const sessionKey = this.getSessionKey(sessionId);
      const sessionJson = await redis.get(sessionKey);

      if (!sessionJson) {
        return null;
      }

      // Type guard to ensure sessionJson is a string before parsing
      if (typeof sessionJson !== 'string') {
        console.error('[SessionManager] Invalid session data type:', typeof sessionJson);
        return null;
      }

      const session = JSON.parse(sessionJson);

      // Convert date strings back to Date objects
      return {
        ...session,
        createdAt: new Date(session.createdAt),
        lastActivity: new Date(session.lastActivity),
      };
    } catch (error) {
      console.error('[SessionManager] Error getting session:', error);
      return null;
    }
  }

  /**
   * Update session activity timestamp
   */
  async updateActivity(sessionId: string): Promise<void> {
    try {
      const redis = await this.ensureRedis();
      const session = await this.getSession(sessionId);

      if (!session) {
        return;
      }

      // Only update if last activity was more than ACTIVITY_UPDATE_INTERVAL ago
      const timeSinceLastActivity = Date.now() - session.lastActivity.getTime();
      if (timeSinceLastActivity < SESSION_CONFIG.ACTIVITY_UPDATE_INTERVAL * 1000) {
        return;
      }

      session.lastActivity = new Date();

      const sessionKey = this.getSessionKey(sessionId);
      await redis.setEx(
        sessionKey,
        SESSION_CONFIG.SESSION_TTL,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('[SessionManager] Error updating activity:', error);
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const redis = await this.ensureRedis();
      const session = await this.getSession(sessionId);

      if (!session) {
        return;
      }

      // Remove session data
      const sessionKey = this.getSessionKey(sessionId);
      await redis.del(sessionKey);

      // Remove from user's session list
      const userSessionsKey = this.getUserSessionsKey(session.userId);
      await redis.sRem(userSessionsKey, sessionId);

      console.log(`[SessionManager] Deleted session ${sessionId} for user ${session.userId}`);
    } catch (error) {
      console.error('[SessionManager] Error deleting session:', error);
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<void> {
    try {
      const redis = await this.ensureRedis();
      const userSessionsKey = this.getUserSessionsKey(userId);

      // Get all session IDs for the user
      const sessionIds = await redis.sMembers(userSessionsKey);

      // Delete each session
      for (const sessionId of sessionIds) {
        const sessionKey = this.getSessionKey(sessionId);
        await redis.del(sessionKey);
      }

      // Clear the user's session list
      await redis.del(userSessionsKey);

      console.log(`[SessionManager] Deleted all sessions for user ${userId}`);
    } catch (error) {
      console.error('[SessionManager] Error deleting user sessions:', error);
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      const redis = await this.ensureRedis();
      const userSessionsKey = this.getUserSessionsKey(userId);

      // Get all session IDs
      const sessionIds = await redis.sMembers(userSessionsKey);

      // Get session data for each ID
      const sessions: SessionData[] = [];
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions.sort((a, b) =>
        b.lastActivity.getTime() - a.lastActivity.getTime()
      );
    } catch (error) {
      console.error('[SessionManager] Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Enforce maximum sessions per user
   */
  private async enforceMaxSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);

      if (sessions.length > SESSION_CONFIG.MAX_SESSIONS_PER_USER) {
        // Sort by last activity (oldest first)
        const sortedSessions = sessions.sort((a, b) =>
          a.lastActivity.getTime() - b.lastActivity.getTime()
        );

        // Delete oldest sessions to get under the limit
        const sessionsToDelete = sortedSessions.slice(
          0,
          sessions.length - SESSION_CONFIG.MAX_SESSIONS_PER_USER
        );

        for (const session of sessionsToDelete) {
          const sessionKey = this.getSessionKey(
            `${session.userId}:${session.createdAt.getTime()}`
          );
          await this.deleteSession(sessionKey);
        }

        console.log(`[SessionManager] Enforced max sessions for user ${userId}, deleted ${sessionsToDelete.length} old sessions`);
      }
    } catch (error) {
      console.error('[SessionManager] Error enforcing max sessions:', error);
    }
  }

  /**
   * Add token to blacklist (for logout/revocation)
   */
  async blacklistToken(token: string, expiresIn?: number): Promise<void> {
    try {
      const redis = await this.ensureRedis();
      const blacklistKey = this.getBlacklistKey(token);
      const ttl = expiresIn || SESSION_CONFIG.BLACKLIST_TTL;

      await redis.setEx(blacklistKey, ttl, 'true');
      console.log(`[SessionManager] Blacklisted token (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('[SessionManager] Error blacklisting token:', error);
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const redis = await this.ensureRedis();
      const blacklistKey = this.getBlacklistKey(token);
      const result = await redis.get(blacklistKey);
      return result === 'true';
    } catch (error) {
      console.error('[SessionManager] Error checking blacklist:', error);
      return false;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    activeUsers: number;
  }> {
    try {
      const redis = await this.ensureRedis();

      // Count all session keys
      const sessionKeys = await redis.keys('session:*');
      const totalActiveSessions = sessionKeys.length;

      // Count unique users
      const userSessionKeys = await redis.keys('user:*:sessions');
      const activeUsers = userSessionKeys.length;

      return {
        totalActiveSessions,
        activeUsers,
      };
    } catch (error) {
      console.error('[SessionManager] Error getting session stats:', error);
      return {
        totalActiveSessions: 0,
        activeUsers: 0,
      };
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
