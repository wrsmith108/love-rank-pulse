import { PrismaClient, Match, MatchResult, MatchStatus, MatchType, ResultType, VerificationStatus } from '@prisma/client';
import { ELOCalculator } from '../lib/elo';
import RedisClient, { CacheKeys, CacheTTL } from '../lib/redis';

/**
 * ELO Rating Configuration
 */
const ELO_CONFIG = {
  K_FACTOR: 32,           // Standard K-factor for rating changes
  DEFAULT_RATING: 1200,   // Starting ELO rating
  MIN_RATING: 100,        // Minimum possible rating
  MAX_RATING: 3000        // Maximum possible rating
};

/**
 * Type for match creation input
 */
export interface CreateMatchInput {
  player1Id: string;
  player2Id: string;
  matchType?: MatchType;
  scheduledAt?: Date;
  bestOf?: number;
  timeLimit?: number;
  tournamentId?: string;
  roundNumber?: number;
  notes?: string;
}

/**
 * Type for match result input
 */
export interface SubmitMatchResultInput {
  matchId: string;
  player1Score: number;
  player2Score: number;
  resultType?: ResultType;
  verifiedBy?: string;
}

/**
 * Type for match with player details
 */
export interface MatchWithPlayers extends Match {
  player1: {
    id: string;
    username: string;
    elo_rating: number;
  };
  player2: {
    id: string;
    username: string;
    elo_rating: number;
  };
  result?: MatchResult | null;
}

/**
 * Type for player match statistics
 */
export interface PlayerMatchStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentStreak: number;
  currentElo: number;
  peakElo: number;
  averageOpponentElo: number;
}

/**
 * Service for managing match data and ELO ratings with Prisma and Redis caching
 */
export class MatchService {
  private prisma: PrismaClient;
  private redis: Promise<ReturnType<typeof createClient>> | null = null;
  private cacheEnabled: boolean = true;

  constructor(prismaClient?: PrismaClient, cacheEnabled: boolean = true) {
    this.prisma = prismaClient || new PrismaClient();
    this.cacheEnabled = cacheEnabled && process.env.NODE_ENV !== 'test';

    // Initialize Redis connection if caching is enabled
    if (this.cacheEnabled) {
      this.redis = RedisClient.getInstance();
    }
  }

  /**
   * Get Redis client instance (if caching is enabled)
   */
  private async getRedisClient() {
    if (!this.cacheEnabled || !this.redis) {
      return null;
    }
    return await this.redis;
  }

  /**
   * Get cached data from Redis
   */
  private async getCached<T>(key: string): Promise<T | null> {
    try {
      const client = await this.getRedisClient();
      if (!client) return null;

      const cached = await client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set cached data in Redis with TTL
   */
  private async setCache<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const client = await this.getRedisClient();
      if (!client) return;

      await client.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  /**
   * Invalidate cached data
   */
  private async invalidateCache(pattern: string): Promise<void> {
    try {
      const client = await this.getRedisClient();
      if (!client) return;

      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
    } catch (error) {
      console.error('Redis invalidate error:', error);
    }
  }

  /**
   * Calculate ELO changes for both players based on match result
   * Uses the ELOCalculator utility for consistent calculations
   * @param player1 Player 1 data
   * @param player2 Player 2 data
   * @param player1Score Player 1's actual score (1 for win, 0.5 for draw, 0 for loss)
   * @returns Object with new ratings and rating changes
   */
  private calculateEloChanges(
    player1: { elo_rating: number; matches_played: number },
    player2: { elo_rating: number; matches_played: number },
    player1Score: number
  ): {
    player1NewRating: number;
    player2NewRating: number;
    ratingChange: number;
  } {
    const isDraw = player1Score === 0.5;

    // Determine winner and loser for ELO calculation
    if (isDraw) {
      // For draws, both players get 0.5 score
      const result = ELOCalculator.calculateNewRatings(
        player1.elo_rating,
        player2.elo_rating,
        player1.matches_played,
        player2.matches_played,
        true // isDraw
      );

      return {
        player1NewRating: result.winnerNewElo,
        player2NewRating: result.loserNewElo,
        ratingChange: result.ratingChange
      };
    } else {
      // For wins/losses, determine which player won
      const player1Won = player1Score === 1;
      const winnerRating = player1Won ? player1.elo_rating : player2.elo_rating;
      const loserRating = player1Won ? player2.elo_rating : player1.elo_rating;
      const winnerMatches = player1Won ? player1.matches_played : player2.matches_played;
      const loserMatches = player1Won ? player2.matches_played : player1.matches_played;

      const result = ELOCalculator.calculateNewRatings(
        winnerRating,
        loserRating,
        winnerMatches,
        loserMatches,
        false // isDraw
      );

      return {
        player1NewRating: player1Won ? result.winnerNewElo : result.loserNewElo,
        player2NewRating: player1Won ? result.loserNewElo : result.winnerNewElo,
        ratingChange: result.ratingChange
      };
    }
  }

  /**
   * Create a new match
   * @param input Match creation input
   * @returns Created match with player details
   */
  async createMatch(input: CreateMatchInput): Promise<MatchWithPlayers> {
    // Validate players exist
    const [player1, player2] = await Promise.all([
      this.prisma.player.findUnique({ where: { id: input.player1Id } }),
      this.prisma.player.findUnique({ where: { id: input.player2Id } })
    ]);

    if (!player1 || !player2) {
      throw new Error('One or both players not found');
    }

    if (player1.id === player2.id) {
      throw new Error('A player cannot play against themselves');
    }

    // Create match
    const match = await this.prisma.match.create({
      data: {
        player1_id: input.player1Id,
        player2_id: input.player2Id,
        match_type: input.matchType || MatchType.RANKED,
        scheduled_at: input.scheduledAt,
        best_of: input.bestOf || 1,
        time_limit: input.timeLimit,
        tournament_id: input.tournamentId,
        round_number: input.roundNumber,
        notes: input.notes,
        status: input.scheduledAt ? MatchStatus.SCHEDULED : MatchStatus.IN_PROGRESS,
        started_at: input.scheduledAt ? null : new Date()
      },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo_rating: true
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo_rating: true
          }
        },
        result: true
      }
    });

    return match;
  }

  /**
   * Submit match result and update ELO ratings
   * @param input Match result input
   * @returns Match result with updated ratings
   */
  async submitMatchResult(input: SubmitMatchResultInput): Promise<MatchResult> {
    return await this.prisma.$transaction(async (tx) => {
      // Get match with players
      const match = await tx.match.findUnique({
        where: { id: input.matchId },
        include: {
          player1: true,
          player2: true,
          result: true
        }
      });

      if (!match) {
        throw new Error('Match not found');
      }

      if (match.result) {
        throw new Error('Match result already submitted');
      }

      if (match.status === MatchStatus.COMPLETED) {
        throw new Error('Match is already completed');
      }

      // Determine winner and result type
      let winnerId: string | null = null;
      let loserId: string | null = null;
      let resultType = input.resultType || ResultType.WIN;
      let player1ActualScore: number;

      if (input.player1Score > input.player2Score) {
        winnerId = match.player1_id;
        loserId = match.player2_id;
        player1ActualScore = 1; // Win
        resultType = ResultType.WIN;
      } else if (input.player2Score > input.player1Score) {
        winnerId = match.player2_id;
        loserId = match.player1_id;
        player1ActualScore = 0; // Loss
        resultType = ResultType.LOSS;
      } else {
        // Draw
        winnerId = null;
        loserId = null;
        player1ActualScore = 0.5; // Draw
        resultType = ResultType.DRAW;
      }

      // Handle special cases (forfeit, no contest)
      if (input.resultType === ResultType.FORFEIT || input.resultType === ResultType.NO_CONTEST) {
        resultType = input.resultType;
      }

      // Calculate ELO changes using player data including matches_played
      const { player1NewRating, player2NewRating, ratingChange } = this.calculateEloChanges(
        { elo_rating: match.player1.elo_rating, matches_played: match.player1.matches_played },
        { elo_rating: match.player2.elo_rating, matches_played: match.player2.matches_played },
        player1ActualScore
      );

      // Create match result
      const matchResult = await tx.matchResult.create({
        data: {
          match_id: input.matchId,
          winner_id: winnerId,
          loser_id: loserId,
          result_type: resultType,
          player1_score: input.player1Score,
          player2_score: input.player2Score,
          rating_change: ratingChange,
          winner_new_elo: winnerId === match.player1_id ? player1NewRating : (winnerId === match.player2_id ? player2NewRating : null),
          loser_new_elo: loserId === match.player1_id ? player1NewRating : (loserId === match.player2_id ? player2NewRating : null),
          k_factor: ELO_CONFIG.K_FACTOR,
          verification_status: input.verifiedBy ? VerificationStatus.VERIFIED : VerificationStatus.PENDING,
          verified_by: input.verifiedBy,
          verified_at: input.verifiedBy ? new Date() : null
        }
      });

      // Update player ratings and statistics
      await tx.player.update({
        where: { id: match.player1_id },
        data: {
          elo_rating: player1NewRating,
          matches_played: { increment: 1 },
          wins: winnerId === match.player1_id ? { increment: 1 } : undefined,
          losses: loserId === match.player1_id ? { increment: 1 } : undefined,
          draws: resultType === ResultType.DRAW ? { increment: 1 } : undefined,
          last_active_at: new Date()
        }
      });

      await tx.player.update({
        where: { id: match.player2_id },
        data: {
          elo_rating: player2NewRating,
          matches_played: { increment: 1 },
          wins: winnerId === match.player2_id ? { increment: 1 } : undefined,
          losses: loserId === match.player2_id ? { increment: 1 } : undefined,
          draws: resultType === ResultType.DRAW ? { increment: 1 } : undefined,
          last_active_at: new Date()
        }
      });

      // Update match status
      await tx.match.update({
        where: { id: input.matchId },
        data: {
          status: MatchStatus.COMPLETED,
          completed_at: new Date()
        }
      });

      return matchResult;
    });
  }

  /**
   * Get match by ID with player details
   * @param matchId Match ID
   * @returns Match with players or null
   */
  async getMatchById(matchId: string): Promise<MatchWithPlayers | null> {
    return await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo_rating: true
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo_rating: true
          }
        },
        result: true
      }
    });
  }

  /**
   * Get all matches with optional filters
   * @param filters Optional filters (status, matchType, limit)
   * @returns Array of matches
   */
  async getMatches(filters?: {
    status?: MatchStatus;
    matchType?: MatchType;
    limit?: number;
    offset?: number;
  }): Promise<MatchWithPlayers[]> {
    return await this.prisma.match.findMany({
      where: {
        status: filters?.status,
        match_type: filters?.matchType
      },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo_rating: true
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo_rating: true
          }
        },
        result: true
      },
      orderBy: {
        created_at: 'desc'
      },
      take: filters?.limit,
      skip: filters?.offset
    });
  }

  /**
   * Get match history for a player
   * @param playerId Player ID
   * @param limit Maximum number of matches to return
   * @returns Array of matches
   */
  async getPlayerMatchHistory(playerId: string, limit: number = 10): Promise<MatchWithPlayers[]> {
    return await this.prisma.match.findMany({
      where: {
        OR: [
          { player1_id: playerId },
          { player2_id: playerId }
        ]
      },
      include: {
        player1: {
          select: {
            id: true,
            username: true,
            elo_rating: true
          }
        },
        player2: {
          select: {
            id: true,
            username: true,
            elo_rating: true
          }
        },
        result: true
      },
      orderBy: {
        created_at: 'desc'
      },
      take: limit
    });
  }

  /**
   * Get player match statistics
   * @param playerId Player ID
   * @returns Player match statistics
   */
  async getPlayerMatchStats(playerId: string): Promise<PlayerMatchStats> {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        matches_as_player1: {
          include: { result: true }
        },
        matches_as_player2: {
          include: { result: true }
        }
      }
    });

    if (!player) {
      throw new Error('Player not found');
    }

    // Calculate statistics
    const allMatches = [...player.matches_as_player1, ...player.matches_as_player2];
    const completedMatches = allMatches.filter(m => m.status === MatchStatus.COMPLETED && m.result);

    const totalMatches = completedMatches.length;
    const wins = player.wins;
    const losses = player.losses;
    const draws = player.draws;
    const winRate = totalMatches > 0 ? wins / totalMatches : 0;

    // Calculate current streak
    let currentStreak = 0;
    const sortedMatches = completedMatches.sort((a, b) =>
      (b.completed_at?.getTime() || 0) - (a.completed_at?.getTime() || 0)
    );

    for (const match of sortedMatches) {
      if (!match.result) continue;

      if (match.result.winner_id === playerId) {
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else if (match.result.loser_id === playerId) {
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      } else {
        break; // Draw breaks the streak
      }
    }

    // Calculate average opponent ELO
    const opponentRatings = completedMatches.map(match => {
      if (match.player1_id === playerId) {
        return match.player2?.elo_rating || 0;
      } else {
        return match.player1?.elo_rating || 0;
      }
    });

    const averageOpponentElo = opponentRatings.length > 0
      ? opponentRatings.reduce((sum, rating) => sum + rating, 0) / opponentRatings.length
      : 0;

    // Get peak ELO from leaderboard entries
    const leaderboardEntry = await this.prisma.leaderboardEntry.findFirst({
      where: { player_id: playerId },
      orderBy: { peak_elo: 'desc' }
    });

    return {
      totalMatches,
      wins,
      losses,
      draws,
      winRate: Math.round(winRate * 100) / 100,
      currentStreak,
      currentElo: player.elo_rating,
      peakElo: leaderboardEntry?.peak_elo || player.elo_rating,
      averageOpponentElo: Math.round(averageOpponentElo)
    };
  }

  /**
   * Get recent matches (all players)
   * @param limit Maximum number of matches
   * @returns Array of recent matches
   */
  async getRecentMatches(limit: number = 20): Promise<MatchWithPlayers[]> {
    return await this.getMatches({
      status: MatchStatus.COMPLETED,
      limit
    });
  }

  /**
   * Start a match (update status to IN_PROGRESS)
   * @param matchId Match ID
   * @returns Updated match
   */
  async startMatch(matchId: string): Promise<Match> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status === MatchStatus.COMPLETED) {
      throw new Error('Cannot start a completed match');
    }

    return await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.IN_PROGRESS,
        started_at: new Date()
      }
    });
  }

  /**
   * Cancel a match
   * @param matchId Match ID
   * @returns Updated match
   */
  async cancelMatch(matchId: string): Promise<Match> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId }
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.status === MatchStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed match');
    }

    return await this.prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.CANCELLED
      }
    });
  }

  /**
   * Verify a match result
   * @param matchId Match ID
   * @param verifiedBy Verifier ID
   * @returns Updated match result
   */
  async verifyMatchResult(matchId: string, verifiedBy: string): Promise<MatchResult> {
    const result = await this.prisma.matchResult.findUnique({
      where: { match_id: matchId }
    });

    if (!result) {
      throw new Error('Match result not found');
    }

    return await this.prisma.matchResult.update({
      where: { id: result.id },
      data: {
        verification_status: VerificationStatus.VERIFIED,
        verified_by: verifiedBy,
        verified_at: new Date()
      }
    });
  }

  /**
   * Disconnect Prisma client (cleanup)
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Create and export singleton instance
export const matchService = new MatchService();
