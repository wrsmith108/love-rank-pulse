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
    const prismaClient = getPrisma();

    // Parse query parameters
    const {
      type = 'global',
      country,
      limit = '100',
      offset = '0'
    } = req.query;

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    // Build where clause based on filters
    const where: any = {
      is_active: true,
    };

    if (type === 'country' && country) {
      where.player = {
        country_code: country as string,
      };
    }

    // Fetch leaderboard entries with player data
    const entries = await prismaClient.leaderboardEntry.findMany({
      where,
      include: {
        player: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
            country_code: true,
          },
        },
      },
      orderBy: {
        elo_rating: 'desc',
      },
      take: limitNum,
      skip: offsetNum,
    });

    // Get total count for pagination
    const total = await prismaClient.leaderboardEntry.count({ where });

    // Format response
    const leaderboard = entries.map((entry, index) => ({
      rank: offsetNum + index + 1,
      player: {
        id: entry.player.id,
        username: entry.player.username,
        avatar_url: entry.player.avatar_url,
        country_code: entry.player.country_code,
      },
      elo_rating: entry.elo_rating,
      previous_elo: entry.previous_elo,
      matches_played: entry.matches_played,
      wins: entry.wins,
      losses: entry.losses,
      draws: entry.draws,
      win_rate: entry.win_rate,
      current_streak: entry.current_streak,
      rank_change: entry.rank_change,
    }));

    res.status(200).json({
      leaderboard,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch leaderboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
