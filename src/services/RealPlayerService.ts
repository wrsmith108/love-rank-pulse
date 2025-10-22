/**
 * RealPlayerService - Player management with Prisma integration
 *
 * Features:
 * - Player profile management
 * - Statistics tracking
 * - Friend management
 * - Player search and filtering
 */

import { PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma';
import RedisClient, { CacheKeys, CacheTTL } from '../lib/redis';
import { createClient } from 'redis';

export interface PlayerStats {
  playerId: string;
  eloRating: number;
  rank: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  bestWinStreak: number;
  averageMatchDuration?: number;
}

export interface PlayerProfile {
  id: string;
  username: string;
  email: string;
  eloRating: number;
  rank: number;
  avatarUrl?: string | null;
  bio?: string | null;
  countryCode?: string | null;
  isActive: boolean;
  isVerified: boolean;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
  lastActiveAt: Date;
}

export class RealPlayerService {
  private redisClient: ReturnType<typeof createClient> | null = null;
  private redisEnabled: boolean = true;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = await RedisClient.getInstance();
      this.redisEnabled = true;
      console.log('✅ RealPlayerService: Redis initialized');
    } catch (error) {
      console.warn('⚠️  RealPlayerService: Redis unavailable, using direct DB queries', error);
      this.redisEnabled = false;
      this.redisClient = null;
    }
  }

  /**
   * Get player by ID
   */
  async getPlayerById(playerId: string): Promise<PlayerProfile | null> {
    try {
      // Try cache first
      const cacheKey = CacheKeys.playerStats(playerId);
      const cached = await this.getFromCache<PlayerProfile>(cacheKey);
      if (cached) return cached;

      const player = await prisma.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          username: true,
          email: true,
          elo_rating: true,
          rank: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          created_at: true,
          last_active_at: true
        }
      });

      if (!player) return null;

      const profile: PlayerProfile = {
        id: player.id,
        username: player.username,
        email: player.email,
        eloRating: player.elo_rating,
        rank: player.rank,
        avatarUrl: player.avatar_url,
        bio: player.bio,
        countryCode: player.country_code,
        isActive: player.is_active,
        isVerified: player.is_verified,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        createdAt: player.created_at,
        lastActiveAt: player.last_active_at
      };

      await this.setCache(cacheKey, profile, CacheTTL.PLAYER_STATS);
      return profile;
    } catch (error) {
      console.error('Error fetching player:', error);
      return null;
    }
  }

  /**
   * Get multiple players by their IDs
   */
  async getPlayersByIds(playerIds: string[]): Promise<PlayerProfile[]> {
    if (playerIds.length === 0) {
      return [];
    }

    try {
      const players = await prisma.player.findMany({
        where: { id: { in: playerIds } },
        select: {
          id: true,
          username: true,
          email: true,
          elo_rating: true,
          rank: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          created_at: true,
          last_active_at: true
        }
      });

      return players.map(player => ({
        id: player.id,
        username: player.username,
        email: player.email,
        eloRating: player.elo_rating,
        rank: player.rank,
        avatarUrl: player.avatar_url,
        bio: player.bio,
        countryCode: player.country_code,
        isActive: player.is_active,
        isVerified: player.is_verified,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        createdAt: player.created_at,
        lastActiveAt: player.last_active_at
      }));
    } catch (error) {
      console.error('Error fetching players by IDs:', error);
      return [];
    }
  }

  /**
   * Get all players with optional pagination
   */
  async getAllPlayers(limit?: number, offset?: number): Promise<PlayerProfile[]> {
    try {
      const players = await prisma.player.findMany({
        skip: offset,
        take: limit,
        select: {
          id: true,
          username: true,
          email: true,
          elo_rating: true,
          rank: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          created_at: true,
          last_active_at: true
        },
        orderBy: { elo_rating: 'desc' }
      });

      return players.map(player => ({
        id: player.id,
        username: player.username,
        email: player.email,
        eloRating: player.elo_rating,
        rank: player.rank,
        avatarUrl: player.avatar_url,
        bio: player.bio,
        countryCode: player.country_code,
        isActive: player.is_active,
        isVerified: player.is_verified,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        createdAt: player.created_at,
        lastActiveAt: player.last_active_at
      }));
    } catch (error) {
      console.error('Error fetching all players:', error);
      return [];
    }
  }

  /**
   * Get player statistics
   */
  async getPlayerStats(playerId: string): Promise<PlayerStats | null> {
    try {
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: {
          leaderboard_entries: {
            where: { leaderboard_type: 'GLOBAL' },
            take: 1
          }
        }
      });

      if (!player) return null;

      const leaderboardEntry = player.leaderboard_entries[0];
      const totalMatches = player.wins + player.losses + player.draws;
      const winRate = totalMatches > 0 ? player.wins / totalMatches : 0;

      return {
        playerId: player.id,
        eloRating: player.elo_rating,
        rank: player.rank,
        matchesPlayed: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        winRate: Math.round(winRate * 10000) / 100, // Convert to percentage
        currentStreak: leaderboardEntry?.current_streak || 0,
        bestWinStreak: leaderboardEntry?.best_win_streak || 0
      };
    } catch (error) {
      console.error('Error fetching player stats:', error);
      return null;
    }
  }

  /**
   * Update player profile
   */
  async updatePlayer(playerId: string, updates: {
    username?: string;
    bio?: string;
    avatarUrl?: string;
    countryCode?: string;
  }): Promise<PlayerProfile | null> {
    try {
      const player = await prisma.player.update({
        where: { id: playerId },
        data: {
          username: updates.username,
          bio: updates.bio,
          avatar_url: updates.avatarUrl,
          country_code: updates.countryCode,
          updated_at: new Date()
        },
        select: {
          id: true,
          username: true,
          email: true,
          elo_rating: true,
          rank: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          created_at: true,
          last_active_at: true
        }
      });

      // Invalidate cache
      await this.invalidateCache(playerId);

      return this.mapToPlayerProfile(player);
    } catch (error) {
      console.error('Error updating player:', error);
      return null;
    }
  }

  /**
   * Search players by username
   */
  async searchPlayers(query: string, limit: number = 10): Promise<PlayerProfile[]> {
    try {
      const players = await prisma.player.findMany({
        where: {
          username: {
            contains: query,
            mode: 'insensitive'
          },
          is_active: true
        },
        take: limit,
        orderBy: {
          elo_rating: 'desc'
        },
        select: {
          id: true,
          username: true,
          email: true,
          elo_rating: true,
          rank: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          created_at: true,
          last_active_at: true
        }
      });

      return players.map(this.mapToPlayerProfile);
    } catch (error) {
      console.error('Error searching players:', error);
      return [];
    }
  }

  /**
   * Get players by country
   */
  async getPlayersByCountry(countryCode: string, limit: number = 50): Promise<PlayerProfile[]> {
    try {
      const players = await prisma.player.findMany({
        where: {
          country_code: countryCode,
          is_active: true
        },
        take: limit,
        orderBy: {
          elo_rating: 'desc'
        },
        select: {
          id: true,
          username: true,
          email: true,
          elo_rating: true,
          rank: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          created_at: true,
          last_active_at: true
        }
      });

      return players.map(this.mapToPlayerProfile);
    } catch (error) {
      console.error('Error fetching players by country:', error);
      return [];
    }
  }

  /**
   * Get top players
   */
  async getTopPlayers(limit: number = 10): Promise<PlayerProfile[]> {
    try {
      const players = await prisma.player.findMany({
        where: {
          is_active: true,
          matches_played: { gte: 5 } // Minimum matches to appear in top players
        },
        take: limit,
        orderBy: {
          elo_rating: 'desc'
        },
        select: {
          id: true,
          username: true,
          email: true,
          elo_rating: true,
          rank: true,
          avatar_url: true,
          bio: true,
          country_code: true,
          is_active: true,
          is_verified: true,
          matches_played: true,
          wins: true,
          losses: true,
          draws: true,
          created_at: true,
          last_active_at: true
        }
      });

      return players.map(this.mapToPlayerProfile);
    } catch (error) {
      console.error('Error fetching top players:', error);
      return [];
    }
  }

  /**
   * Update player stats after match
   */
  async updatePlayerStats(playerId: string, updates: {
    eloChange: number;
    won: boolean;
    draw: boolean;
  }): Promise<void> {
    try {
      await prisma.player.update({
        where: { id: playerId },
        data: {
          elo_rating: { increment: updates.eloChange },
          matches_played: { increment: 1 },
          wins: updates.won ? { increment: 1 } : undefined,
          losses: !updates.won && !updates.draw ? { increment: 1 } : undefined,
          draws: updates.draw ? { increment: 1 } : undefined,
          updated_at: new Date()
        }
      });

      // Invalidate cache
      await this.invalidateCache(playerId);
    } catch (error) {
      console.error('Error updating player stats:', error);
      throw error;
    }
  }

  /**
   * Map database player to PlayerProfile
   */
  private mapToPlayerProfile(player: any): PlayerProfile {
    return {
      id: player.id,
      username: player.username,
      email: player.email,
      eloRating: player.elo_rating,
      rank: player.rank,
      avatarUrl: player.avatar_url,
      bio: player.bio,
      countryCode: player.country_code,
      isActive: player.is_active,
      isVerified: player.is_verified,
      matchesPlayed: player.matches_played,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      createdAt: player.created_at,
      lastActiveAt: player.last_active_at
    };
  }

  /**
   * Cache operations
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.redisEnabled || !this.redisClient) return null;
    try {
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(String(cached)) as T : null;
    } catch (error) {
      console.error(`Cache read error for key ${key}:`, error);
      return null;
    }
  }

  private async setCache(key: string, value: any, ttl: number): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) return;
    try {
      await this.redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error(`Cache write error for key ${key}:`, error);
    }
  }

  private async invalidateCache(playerId: string): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) return;
    try {
      const pattern = `player:${playerId}:*`;
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient.del(keys);
      }
    } catch (error) {
      console.error('Cache invalidation failed:', error);
    }
  }
}

// Export singleton instance
export const realPlayerService = new RealPlayerService();
