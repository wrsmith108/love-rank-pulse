/**
 * LeaderboardService - Real-time rankings with Prisma & Redis caching
 *
 * Features:
 * - Prisma queries for real-time leaderboard data
 * - Redis caching layer (60s TTL) for performance
 * - Cache invalidation on rating updates
 * - Session, country, and global leaderboard generation
 * - Real-time rank updates after match completion
 * - Efficient denormalization into LeaderboardEntry table
 * - Pagination support
 * - Rank range filtering
 * - Player rank lookup
 * - Cache-aside pattern with graceful fallback
 */

import { LeaderboardType, MatchStatus, ResultType } from '@prisma/client';
import prisma from '../lib/prisma';
import RedisClient, { CacheKeys, CacheTTL } from '../lib/redis';
import { createClient } from 'redis';

type RedisClientType = ReturnType<typeof createClient>;

// Types for API responses
export interface LeaderboardEntry {
  playerId: string;
  username: string;
  rank: number;
  eloRating: number;
  previousRank?: number;
  rankChange: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  peakElo?: number;
  avatarUrl?: string;
  countryCode?: string;
  isActive: boolean;
  lastMatchAt?: Date;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalPlayers: number;
  page: number;
  limit: number;
  hasMore: boolean;
  lastUpdated: Date;
  leaderboardType: LeaderboardType;
  seasonId?: string | null;
  countryCode?: string | null;
}

export interface PlayerRankInfo {
  playerId: string;
  rank: number;
  totalPlayers: number;
  percentile: number;
  eloRating: number;
}

export interface SessionLeaderboardOptions {
  sessionId: string;
  limit?: number;
  minMatches?: number;
}

export interface CountryLeaderboardOptions {
  countryCode: string;
  page?: number;
  limit?: number;
  seasonId?: string | null;
}

export interface MatchCompletionData {
  matchId: string;
  player1Id: string;
  player2Id: string;
  winnerId?: string | null;
  loserId?: string | null;
  resultType: ResultType;
  ratingChange: number;
  player1NewElo: number;
  player2NewElo: number;
}

/**
 * LeaderboardService - Core service for leaderboard operations
 */
export class LeaderboardService {
  private redisClient: RedisClientType | null = null;
  private redisEnabled: boolean = true;

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis client with error handling
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = await RedisClient.getInstance();
      this.redisEnabled = true;
      console.log('✅ LeaderboardService: Redis initialized');
    } catch (error) {
      console.warn('⚠️  LeaderboardService: Redis unavailable, using direct DB queries', error);
      this.redisEnabled = false;
      this.redisClient = null;
    }
  }

  /**
   * Get leaderboard with pagination and caching
   *
   * @param options - Query options
   * @returns Paginated leaderboard data
   */
  async getLeaderboard(options: {
    page?: number;
    limit?: number;
    leaderboardType?: LeaderboardType;
    seasonId?: string | null;
    activeOnly?: boolean;
    countryCode?: string | null;
  }): Promise<LeaderboardResponse> {
    const {
      page = 1,
      limit = 50,
      leaderboardType = LeaderboardType.GLOBAL,
      seasonId = null,
      activeOnly = true,
      countryCode = null,
    } = options;

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      throw new Error('Invalid pagination parameters');
    }

    const offset = (page - 1) * limit;
    const cacheKey = this.buildCacheKey({
      page,
      limit,
      leaderboardType,
      seasonId,
      activeOnly,
      countryCode
    });

    // Try cache first
    const cached = await this.getFromCache<LeaderboardResponse>(cacheKey);
    if (cached) {
      console.log(`✅ Cache hit: ${cacheKey}`);
      return cached;
    }

    console.log(`❌ Cache miss: ${cacheKey}`);

    // Query database
    const [entries, totalPlayers] = await Promise.all([
      this.queryLeaderboardEntries({
        offset,
        limit,
        leaderboardType,
        seasonId,
        activeOnly,
        countryCode
      }),
      this.countTotalPlayers({
        leaderboardType,
        seasonId,
        activeOnly,
        countryCode
      }),
    ]);

    const response: LeaderboardResponse = {
      entries: entries.map(this.mapToLeaderboardEntry),
      totalPlayers,
      page,
      limit,
      hasMore: offset + entries.length < totalPlayers,
      lastUpdated: new Date(),
      leaderboardType,
      seasonId,
      countryCode,
    };

    // Cache the result
    await this.setCache(cacheKey, response, CacheTTL.LEADERBOARD);

    return response;
  }

  /**
   * Get country-specific leaderboard
   *
   * @param options - Country leaderboard options
   * @returns Country leaderboard data
   */
  async getCountryLeaderboard(options: CountryLeaderboardOptions): Promise<LeaderboardResponse> {
    const { countryCode, page = 1, limit = 50, seasonId = null } = options;

    if (!countryCode || countryCode.length !== 2) {
      throw new Error('Invalid country code (must be 2-letter ISO code)');
    }

    return this.getLeaderboard({
      page,
      limit,
      leaderboardType: LeaderboardType.REGIONAL,
      seasonId,
      activeOnly: true,
      countryCode: countryCode.toUpperCase(),
    });
  }

  /**
   * Generate session leaderboard from recent match results
   *
   * @param options - Session leaderboard options
   * @returns Session leaderboard entries
   */
  async getSessionLeaderboard(options: SessionLeaderboardOptions): Promise<LeaderboardEntry[]> {
    const { sessionId, limit = 20, minMatches = 1 } = options;

    const cacheKey = `leaderboard:session:${sessionId}:limit:${limit}:minMatches:${minMatches}`;
    const cached = await this.getFromCache<LeaderboardEntry[]>(cacheKey);

    if (cached) {
      console.log(`✅ Session leaderboard cache hit: ${sessionId}`);
      return cached;
    }

    // Query all completed matches in this session
    const matches = await prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED,
        // Assuming session info stored in notes or tournament_id
        tournament_id: sessionId,
      },
      include: {
        result: true,
        player1: true,
        player2: true,
      },
      orderBy: {
        completed_at: 'desc',
      },
    });

    // Aggregate session statistics per player
    const playerStats = new Map<string, {
      playerId: string;
      username: string;
      wins: number;
      losses: number;
      draws: number;
      eloRating: number;
      matchesPlayed: number;
      avatarUrl?: string;
      countryCode?: string;
    }>();

    for (const match of matches) {
      if (!match.result) continue;

      const { player1, player2, result } = match;

      // Initialize player1 stats
      if (!playerStats.has(player1.id)) {
        playerStats.set(player1.id, {
          playerId: player1.id,
          username: player1.username,
          wins: 0,
          losses: 0,
          draws: 0,
          eloRating: player1.elo_rating,
          matchesPlayed: 0,
          avatarUrl: player1.avatar_url || undefined,
          countryCode: player1.country_code || undefined,
        });
      }

      // Initialize player2 stats
      if (!playerStats.has(player2.id)) {
        playerStats.set(player2.id, {
          playerId: player2.id,
          username: player2.username,
          wins: 0,
          losses: 0,
          draws: 0,
          eloRating: player2.elo_rating,
          matchesPlayed: 0,
          avatarUrl: player2.avatar_url || undefined,
          countryCode: player2.country_code || undefined,
        });
      }

      const p1Stats = playerStats.get(player1.id)!;
      const p2Stats = playerStats.get(player2.id)!;

      p1Stats.matchesPlayed++;
      p2Stats.matchesPlayed++;

      if (result.result_type === ResultType.DRAW) {
        p1Stats.draws++;
        p2Stats.draws++;
      } else if (result.winner_id === player1.id) {
        p1Stats.wins++;
        p2Stats.losses++;
      } else if (result.winner_id === player2.id) {
        p2Stats.wins++;
        p1Stats.losses++;
      }
    }

    // Filter by minimum matches and sort by wins, then ELO
    const entries = Array.from(playerStats.values())
      .filter(stats => stats.matchesPlayed >= minMatches)
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.eloRating - a.eloRating;
      })
      .slice(0, limit)
      .map((stats, index) => ({
        playerId: stats.playerId,
        username: stats.username,
        rank: index + 1,
        eloRating: stats.eloRating,
        rankChange: 0,
        matchesPlayed: stats.matchesPlayed,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        winRate: stats.matchesPlayed > 0
          ? stats.wins / stats.matchesPlayed
          : 0,
        currentStreak: 0, // Would need to calculate from match order
        avatarUrl: stats.avatarUrl,
        countryCode: stats.countryCode,
        isActive: true,
      }));

    // Cache for short duration
    await this.setCache(cacheKey, entries, 30); // 30 seconds TTL for session data

    return entries;
  }

  /**
   * Process match completion and update leaderboards in real-time
   *
   * @param data - Match completion data
   */
  async processMatchCompletion(data: MatchCompletionData): Promise<void> {
    const {
      matchId,
      player1Id,
      player2Id,
      winnerId,
      loserId,
      resultType,
      ratingChange,
      player1NewElo,
      player2NewElo,
    } = data;

    try {
      // Use transaction for atomic updates
      await prisma.$transaction(async (tx) => {
        // 1. Update Player ELO ratings
        await tx.player.update({
          where: { id: player1Id },
          data: {
            elo_rating: player1NewElo,
            matches_played: { increment: 1 },
            wins: winnerId === player1Id ? { increment: 1 } : undefined,
            losses: loserId === player1Id ? { increment: 1 } : undefined,
            draws: resultType === ResultType.DRAW ? { increment: 1 } : undefined,
            last_active_at: new Date(),
          },
        });

        await tx.player.update({
          where: { id: player2Id },
          data: {
            elo_rating: player2NewElo,
            matches_played: { increment: 1 },
            wins: winnerId === player2Id ? { increment: 1 } : undefined,
            losses: loserId === player2Id ? { increment: 1 } : undefined,
            draws: resultType === ResultType.DRAW ? { increment: 1 } : undefined,
            last_active_at: new Date(),
          },
        });

        // 2. Update or create LeaderboardEntry for GLOBAL
        await this.updateOrCreateLeaderboardEntry(
          tx,
          player1Id,
          player1NewElo,
          winnerId === player1Id ? 'win' : loserId === player1Id ? 'loss' : 'draw',
          LeaderboardType.GLOBAL,
          null
        );

        await this.updateOrCreateLeaderboardEntry(
          tx,
          player2Id,
          player2NewElo,
          winnerId === player2Id ? 'win' : loserId === player2Id ? 'loss' : 'draw',
          LeaderboardType.GLOBAL,
          null
        );

        // 3. Update regional leaderboards if players have country codes
        const [player1, player2] = await Promise.all([
          tx.player.findUnique({
            where: { id: player1Id },
            select: { country_code: true },
          }),
          tx.player.findUnique({
            where: { id: player2Id },
            select: { country_code: true },
          }),
        ]);

        if (player1?.country_code) {
          await this.updateOrCreateLeaderboardEntry(
            tx,
            player1Id,
            player1NewElo,
            winnerId === player1Id ? 'win' : loserId === player1Id ? 'loss' : 'draw',
            LeaderboardType.REGIONAL,
            null
          );
        }

        if (player2?.country_code) {
          await this.updateOrCreateLeaderboardEntry(
            tx,
            player2Id,
            player2NewElo,
            winnerId === player2Id ? 'win' : loserId === player2Id ? 'loss' : 'draw',
            LeaderboardType.REGIONAL,
            null
          );
        }
      });

      // 4. Trigger rank recalculation (async, non-blocking)
      setImmediate(() => {
        this.recalculateRanks(LeaderboardType.GLOBAL, null).catch(err =>
          console.error('❌ Failed to recalculate global ranks:', err)
        );
        this.recalculateRanks(LeaderboardType.REGIONAL, null).catch(err =>
          console.error('❌ Failed to recalculate regional ranks:', err)
        );
      });

      // 5. Invalidate all relevant caches
      await this.invalidateCache(player1Id);
      await this.invalidateCache(player2Id);

      console.log(`✅ Match ${matchId} processed: ${player1Id} vs ${player2Id}`);
    } catch (error) {
      console.error('❌ Failed to process match completion:', error);
      throw error;
    }
  }

  /**
   * Update or create a leaderboard entry (helper for denormalization)
   */
  private async updateOrCreateLeaderboardEntry(
    tx: any,
    playerId: string,
    newElo: number,
    outcome: 'win' | 'loss' | 'draw',
    leaderboardType: LeaderboardType,
    seasonId: string | null
  ): Promise<void> {
    const existing = await tx.leaderboardEntry.findFirst({
      where: {
        player_id: playerId,
        season_id: seasonId,
        leaderboard_type: leaderboardType,
      },
    });

    const wins = existing ? existing.wins + (outcome === 'win' ? 1 : 0) : (outcome === 'win' ? 1 : 0);
    const losses = existing ? existing.losses + (outcome === 'loss' ? 1 : 0) : (outcome === 'loss' ? 1 : 0);
    const draws = existing ? existing.draws + (outcome === 'draw' ? 1 : 0) : (outcome === 'draw' ? 1 : 0);
    const matchesPlayed = wins + losses + draws;
    const winRate = matchesPlayed > 0 ? wins / matchesPlayed : 0;

    // Calculate streak
    let currentStreak = existing?.current_streak || 0;
    if (outcome === 'win') {
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
    } else if (outcome === 'loss') {
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
    } else {
      currentStreak = 0; // Reset on draw
    }

    const bestWinStreak = Math.max(
      existing?.best_win_streak || 0,
      currentStreak > 0 ? currentStreak : 0
    );

    const peakElo = Math.max(existing?.peak_elo || newElo, newElo);
    const lowestElo = Math.min(existing?.lowest_elo || newElo, newElo);

    if (existing) {
      await tx.leaderboardEntry.update({
        where: { id: existing.id },
        data: {
          elo_rating: newElo,
          previous_elo: existing.elo_rating,
          peak_elo: peakElo,
          lowest_elo: lowestElo,
          wins,
          losses,
          draws,
          matches_played: matchesPlayed,
          win_rate: winRate,
          current_streak: currentStreak,
          best_win_streak: bestWinStreak,
          last_match_at: new Date(),
          last_updated: new Date(),
        },
      });
    } else {
      await tx.leaderboardEntry.create({
        data: {
          player_id: playerId,
          season_id: seasonId,
          leaderboard_type: leaderboardType,
          rank: 0, // Will be recalculated
          elo_rating: newElo,
          previous_elo: 1200,
          peak_elo: peakElo,
          lowest_elo: lowestElo,
          wins,
          losses,
          draws,
          matches_played: matchesPlayed,
          win_rate: winRate,
          current_streak: currentStreak,
          best_win_streak: bestWinStreak,
          last_match_at: new Date(),
        },
      });
    }
  }

  /**
   * Query leaderboard entries from database
   */
  private async queryLeaderboardEntries(options: {
    offset: number;
    limit: number;
    leaderboardType: LeaderboardType;
    seasonId: string | null;
    activeOnly: boolean;
    countryCode?: string | null;
  }) {
    const { offset, limit, leaderboardType, seasonId, activeOnly, countryCode } = options;

    // Build where clause
    const where: any = {
      leaderboard_type: leaderboardType,
      season_id: seasonId,
      ...(activeOnly && { is_active: true }),
    };

    // Add country filter if provided
    if (countryCode && leaderboardType === LeaderboardType.REGIONAL) {
      where.player = {
        country_code: countryCode.toUpperCase(),
      };
    }

    return await prisma.leaderboardEntry.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
            country_code: true,
            is_active: true,
          },
        },
      },
      orderBy: {
        rank: 'asc',
      },
      skip: offset,
      take: limit,
    });
  }

  /**
   * Count total players in leaderboard
   */
  private async countTotalPlayers(options: {
    leaderboardType: LeaderboardType;
    seasonId: string | null;
    activeOnly: boolean;
    countryCode?: string | null;
  }): Promise<number> {
    const { leaderboardType, seasonId, activeOnly, countryCode } = options;

    const where: any = {
      leaderboard_type: leaderboardType,
      season_id: seasonId,
      ...(activeOnly && { is_active: true }),
    };

    if (countryCode && leaderboardType === LeaderboardType.REGIONAL) {
      where.player = {
        country_code: countryCode.toUpperCase(),
      };
    }

    return await prisma.leaderboardEntry.count({ where });
  }

  /**
   * Get leaderboard entries by rank range
   *
   * @param minRank - Minimum rank (inclusive)
   * @param maxRank - Maximum rank (inclusive)
   * @param leaderboardType - Type of leaderboard
   * @returns Leaderboard entries in rank range
   */
  async getLeaderboardByRankRange(
    minRank: number,
    maxRank: number,
    leaderboardType: LeaderboardType = LeaderboardType.GLOBAL,
    seasonId: string | null = null
  ): Promise<LeaderboardEntry[]> {
    if (minRank < 1 || maxRank < minRank) {
      throw new Error('Invalid rank range');
    }

    const cacheKey = `leaderboard:range:${minRank}-${maxRank}:${leaderboardType}:${seasonId}`;
    const cached = await this.getFromCache<LeaderboardEntry[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const entries = await prisma.leaderboardEntry.findMany({
      where: {
        leaderboard_type: leaderboardType,
        season_id: seasonId,
        rank: {
          gte: minRank,
          lte: maxRank,
        },
      },
      include: {
        player: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
            country_code: true,
            is_active: true,
          },
        },
      },
      orderBy: {
        rank: 'asc',
      },
    });

    const result = entries.map(this.mapToLeaderboardEntry);
    await this.setCache(cacheKey, result, CacheTTL.LEADERBOARD);

    return result;
  }

  /**
   * Get player's rank information
   *
   * @param playerId - Player ID
   * @param leaderboardType - Type of leaderboard
   * @returns Player rank information
   */
  async getPlayerRank(
    playerId: string,
    leaderboardType: LeaderboardType = LeaderboardType.GLOBAL,
    seasonId: string | null = null
  ): Promise<PlayerRankInfo | null> {
    const cacheKey = CacheKeys.playerRank(playerId, `${leaderboardType}:${seasonId}`);
    const cached = await this.getFromCache<PlayerRankInfo>(cacheKey);

    if (cached) {
      return cached;
    }

    const [entry, totalPlayers] = await Promise.all([
      prisma.leaderboardEntry.findFirst({
        where: {
          player_id: playerId,
          leaderboard_type: leaderboardType,
          season_id: seasonId,
        },
        select: {
          rank: true,
          elo_rating: true,
        },
      }),
      this.countTotalPlayers({ leaderboardType, seasonId, activeOnly: false }),
    ]);

    if (!entry) {
      return null;
    }

    const percentile = ((totalPlayers - entry.rank) / totalPlayers) * 100;

    const result: PlayerRankInfo = {
      playerId,
      rank: entry.rank,
      totalPlayers,
      percentile: Math.round(percentile * 100) / 100,
      eloRating: entry.elo_rating,
    };

    await this.setCache(cacheKey, result, CacheTTL.PLAYER_STATS);

    return result;
  }

  /**
   * Get top N players from leaderboard
   *
   * @param limit - Number of top players to retrieve
   * @param leaderboardType - Type of leaderboard
   * @returns Top players
   */
  async getTopPlayers(
    limit: number = 10,
    leaderboardType: LeaderboardType = LeaderboardType.GLOBAL,
    seasonId: string | null = null
  ): Promise<LeaderboardEntry[]> {
    if (limit < 1 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }

    return await this.getLeaderboardByRankRange(1, limit, leaderboardType, seasonId);
  }

  /**
   * Invalidate cache for leaderboard
   * Call this when player ratings are updated
   *
   * @param playerId - Optional player ID to invalidate specific player caches
   */
  async invalidateCache(playerId?: string): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }

    try {
      // Invalidate all leaderboard caches
      const pattern = 'leaderboard:*';
      const keys = await this.redisClient.keys(pattern);

      if (keys.length > 0) {
        await this.redisClient.del(keys);
        console.log(`🗑️  Invalidated ${keys.length} leaderboard cache keys`);
      }

      // Invalidate player-specific caches
      if (playerId) {
        const playerPattern = `player:${playerId}:*`;
        const playerKeys = await this.redisClient.keys(playerPattern);

        if (playerKeys.length > 0) {
          await this.redisClient.del(playerKeys);
          console.log(`🗑️  Invalidated ${playerKeys.length} player cache keys`);
        }
      }
    } catch (error) {
      console.error('❌ Cache invalidation failed:', error);
    }
  }

  /**
   * Build cache key from query parameters
   */
  private buildCacheKey(params: {
    page: number;
    limit: number;
    leaderboardType: LeaderboardType;
    seasonId: string | null;
    activeOnly: boolean;
    countryCode?: string | null;
  }): string {
    const { page, limit, leaderboardType, seasonId, activeOnly, countryCode } = params;
    return `leaderboard:page:${page}:limit:${limit}:type:${leaderboardType}:season:${seasonId}:active:${activeOnly}:country:${countryCode}`;
  }

  /**
   * Get data from Redis cache
   */
  private async getFromCache<T>(key: string): Promise<T | null> {
    if (!this.redisEnabled || !this.redisClient) {
      return null;
    }

    try {
      const cached = await this.redisClient.get(key);
      if (cached) {
        return JSON.parse(String(cached)) as T;
      }
    } catch (error) {
      console.error(`❌ Cache read error for key ${key}:`, error);
    }

    return null;
  }

  /**
   * Set data in Redis cache with TTL
   */
  private async setCache(key: string, value: any, ttl: number): Promise<void> {
    if (!this.redisEnabled || !this.redisClient) {
      return;
    }

    try {
      await this.redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error(`❌ Cache write error for key ${key}:`, error);
    }
  }

  /**
   * Map database entry to API response format
   */
  private mapToLeaderboardEntry(entry: any): LeaderboardEntry {
    return {
      playerId: entry.player.id,
      username: entry.player.username,
      rank: entry.rank,
      eloRating: entry.elo_rating,
      previousRank: entry.previous_rank,
      rankChange: entry.rank_change,
      matchesPlayed: entry.matches_played,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      winRate: entry.win_rate,
      currentStreak: entry.current_streak,
      peakElo: entry.peak_elo,
      avatarUrl: entry.player.avatar_url,
      countryCode: entry.player.country_code,
      isActive: entry.is_active,
      lastMatchAt: entry.last_match_at,
    };
  }

  /**
   * Recalculate all ranks (should be run periodically or after batch updates)
   * This ensures ranks are correctly ordered by ELO rating
   */
  async recalculateRanks(
    leaderboardType: LeaderboardType = LeaderboardType.GLOBAL,
    seasonId: string | null = null
  ): Promise<void> {
    try {
      // Get all entries ordered by ELO rating
      const entries = await prisma.leaderboardEntry.findMany({
        where: {
          leaderboard_type: leaderboardType,
          season_id: seasonId,
        },
        orderBy: {
          elo_rating: 'desc',
        },
        select: {
          id: true,
          rank: true,
        },
      });

      // Update ranks in batch
      const updates = entries.map((entry, index) => {
        const newRank = index + 1;
        const previousRank = entry.rank;
        const rankChange = previousRank > 0 ? previousRank - newRank : 0;

        return prisma.leaderboardEntry.update({
          where: { id: entry.id },
          data: {
            rank: newRank,
            previous_rank: previousRank > 0 ? previousRank : newRank,
            rank_change: rankChange,
            last_updated: new Date(),
          },
        });
      });

      await prisma.$transaction(updates);

      // Invalidate all caches
      await this.invalidateCache();

      console.log(`✅ Recalculated ranks for ${entries.length} entries (${leaderboardType})`);
    } catch (error) {
      console.error('❌ Failed to recalculate ranks:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const leaderboardService = new LeaderboardService();
