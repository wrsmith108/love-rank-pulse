import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

// Create a singleton Prisma client for serverless
let prisma: PrismaClient;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Player ID is required' });
      return;
    }

    const prismaClient = getPrisma();

    // Fetch player with stats
    const player = await prismaClient.player.findUnique({
      where: { id },
      include: {
        leaderboard_entries: {
          where: {
            leaderboard_type: 'GLOBAL',
            is_active: true,
          },
          take: 1,
        },
        matches_as_player1: {
          where: {
            status: 'COMPLETED',
          },
          include: {
            result: true,
          },
          orderBy: {
            completed_at: 'desc',
          },
          take: 10,
        },
        matches_as_player2: {
          where: {
            status: 'COMPLETED',
          },
          include: {
            result: true,
          },
          orderBy: {
            completed_at: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!player) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    // Combine and sort recent matches
    const allMatches = [
      ...player.matches_as_player1,
      ...player.matches_as_player2,
    ].sort((a, b) => {
      const aTime = a.completed_at?.getTime() || 0;
      const bTime = b.completed_at?.getTime() || 0;
      return bTime - aTime;
    }).slice(0, 10);

    // Get leaderboard entry
    const leaderboardEntry = player.leaderboard_entries[0];

    // Format response
    const stats = {
      player: {
        id: player.id,
        username: player.username,
        avatar_url: player.avatar_url,
        country_code: player.country_code,
        bio: player.bio,
        created_at: player.created_at,
      },
      rating: {
        current: player.elo_rating,
        peak: player.peakElo,
        lowest: player.lowestElo,
      },
      rank: leaderboardEntry?.rank || null,
      stats: {
        matches_played: player.matches_played,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        win_rate: player.matches_played > 0
          ? Math.round((player.wins / player.matches_played) * 100) / 100
          : 0,
        current_streak: leaderboardEntry?.current_streak || 0,
        best_win_streak: leaderboardEntry?.best_win_streak || 0,
      },
      recent_matches: allMatches.map(match => ({
        id: match.id,
        opponent_id: match.player1_id === player.id ? match.player2_id : match.player1_id,
        result: match.result?.result_type || 'UNKNOWN',
        rating_change: match.result?.rating_change || 0,
        completed_at: match.completed_at,
      })),
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error('Player stats fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch player stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
