import { PrismaClient, MatchStatus, MatchType, ResultType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Country codes for diversity
const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'JP', 'KR', 'BR', 'CA', 'AU', 'SE'];

// Sample player data
const PLAYER_USERNAMES = [
  'ShadowStrike', 'PhantomAce', 'NightHunter', 'BlazeFury',
  'IceViper', 'ThunderBolt', 'SilentReaper', 'StormChaser',
  'CrimsonWolf', 'SilverFox', 'DarkPhoenix', 'GoldenEagle',
  'IronTitan', 'SwiftArrow', 'VoidWalker', 'NeonRider',
  'MysticSage', 'CyberNinja', 'CosmicKnight', 'QuantumShift'
];

// Generate random email from username
const generateEmail = (username: string): string => {
  return `${username.toLowerCase()}@example.com`;
};

// Calculate ELO change
const calculateEloChange = (playerElo: number, opponentElo: number, actualScore: number, kFactor: number = 32): number => {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  return Math.round(kFactor * (actualScore - expectedScore));
};

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.leaderboardEntry.deleteMany();
  await prisma.matchResult.deleteMany();
  await prisma.match.deleteMany();
  await prisma.player.deleteMany();
  console.log('✅ Database cleaned\n');

  // Create 20 players with varied ELO ratings
  console.log('👥 Creating players...');

  // Generate ELO ratings distributed across skill levels
  const baseElos = [
    1000, 1050, 1100, 1150, 1180, // Beginners
    1200, 1250, 1280, 1320, 1350, 1380, 1420, // Intermediate
    1450, 1480, 1520, 1550, // Advanced
    1600, 1650, 1720, 1800 // Experts
  ];

  const players = await Promise.all(
    PLAYER_USERNAMES.map(async (username, index) => {
      const passwordHash = await bcrypt.hash('password123', 10);
      const player = await prisma.player.create({
        data: {
          username,
          email: generateEmail(username),
          password_hash: passwordHash,
          elo_rating: baseElos[index],
          country_code: COUNTRIES[index % COUNTRIES.length],
          is_verified: Math.random() > 0.3, // 70% verified
          avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          bio: `Competitive player since ${2020 + Math.floor(Math.random() * 5)}`,
        }
      });
      console.log(`  ✓ Created player: ${username} (ELO: ${player.elo_rating}, ${player.country_code})`);
      return player;
    })
  );
  console.log(`✅ Created ${players.length} players\n`);

  // Create matches between players (50 matches)
  console.log('⚔️  Creating matches and results...');
  const matchCount = 50;

  for (let i = 0; i < matchCount; i++) {
    // Randomly select two different players
    const player1Index = Math.floor(Math.random() * players.length);
    let player2Index = Math.floor(Math.random() * players.length);
    while (player2Index === player1Index) {
      player2Index = Math.floor(Math.random() * players.length);
    }

    const player1 = players[player1Index];
    const player2 = players[player2Index];

    // Create match timing
    const daysAgo = Math.floor(Math.random() * 30); // Matches within last 30 days
    const scheduledAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const startedAt = new Date(scheduledAt.getTime() + 5 * 60 * 1000); // Started 5 min after scheduled
    const completedAt = new Date(startedAt.getTime() + (15 + Math.random() * 30) * 60 * 1000); // 15-45 min duration

    // Create the match
    const match = await prisma.match.create({
      data: {
        player1_id: player1.id,
        player2_id: player2.id,
        status: MatchStatus.COMPLETED,
        match_type: Math.random() > 0.2 ? MatchType.RANKED : MatchType.FRIENDLY,
        scheduled_at: scheduledAt,
        started_at: startedAt,
        completed_at: completedAt,
        best_of: Math.random() > 0.7 ? 3 : 1,
      }
    });

    // Determine winner based on ELO (higher ELO has better chance but not guaranteed)
    const eloAdvantage = player1.elo_rating - player2.elo_rating;
    const player1WinProbability = 1 / (1 + Math.pow(10, -eloAdvantage / 400));
    const player1Wins = Math.random() < player1WinProbability;

    // Generate match scores
    const player1Score = player1Wins ? (2 + Math.floor(Math.random() * 2)) : Math.floor(Math.random() * 2);
    const player2Score = player1Wins ? Math.floor(Math.random() * 2) : (2 + Math.floor(Math.random() * 2));

    const isDraw = player1Score === player2Score;
    const winnerId = isDraw ? null : (player1Wins ? player1.id : player2.id);
    const loserId = isDraw ? null : (player1Wins ? player2.id : player1.id);

    // Calculate ELO changes
    const actualScore = isDraw ? 0.5 : (player1Wins ? 1 : 0);
    const eloChange = Math.abs(calculateEloChange(player1.elo_rating, player2.elo_rating, actualScore));

    // Update player ratings
    if (!isDraw) {
      const winnerNewElo = player1Wins ? player1.elo_rating + eloChange : player2.elo_rating + eloChange;
      const loserNewElo = player1Wins ? player2.elo_rating - eloChange : player1.elo_rating - eloChange;

      // Update player 1
      await prisma.player.update({
        where: { id: player1.id },
        data: {
          elo_rating: player1Wins ? winnerNewElo : loserNewElo,
          matches_played: { increment: 1 },
          wins: player1Wins ? { increment: 1 } : undefined,
          losses: !player1Wins ? { increment: 1 } : undefined,
          last_active_at: completedAt,
        }
      });

      // Update player 2
      await prisma.player.update({
        where: { id: player2.id },
        data: {
          elo_rating: player1Wins ? loserNewElo : winnerNewElo,
          matches_played: { increment: 1 },
          wins: !player1Wins ? { increment: 1 } : undefined,
          losses: player1Wins ? { increment: 1 } : undefined,
          last_active_at: completedAt,
        }
      });

      // Create match result
      await prisma.matchResult.create({
        data: {
          match_id: match.id,
          winner_id: winnerId,
          loser_id: loserId,
          result_type: ResultType.WIN,
          player1_score: player1Score,
          player2_score: player2Score,
          rating_change: eloChange,
          winner_new_elo: winnerNewElo,
          loser_new_elo: loserNewElo,
        }
      });

      console.log(`  ✓ Match ${i + 1}: ${player1.username} vs ${player2.username} - Winner: ${player1Wins ? player1.username : player2.username} (ELO Δ: ±${eloChange})`);
    } else {
      // Handle draw
      await prisma.player.update({
        where: { id: player1.id },
        data: {
          matches_played: { increment: 1 },
          draws: { increment: 1 },
          last_active_at: completedAt,
        }
      });

      await prisma.player.update({
        where: { id: player2.id },
        data: {
          matches_played: { increment: 1 },
          draws: { increment: 1 },
          last_active_at: completedAt,
        }
      });

      await prisma.matchResult.create({
        data: {
          match_id: match.id,
          result_type: ResultType.DRAW,
          player1_score: player1Score,
          player2_score: player2Score,
          rating_change: 0,
        }
      });

      console.log(`  ✓ Match ${i + 1}: ${player1.username} vs ${player2.username} - Draw`);
    }
  }

  console.log(`✅ Created ${matchCount} matches\n`);

  // Recalculate and set player ranks based on ELO
  console.log('📊 Calculating player rankings...');
  const rankedPlayers = await prisma.player.findMany({
    orderBy: { elo_rating: 'desc' }
  });

  for (let i = 0; i < rankedPlayers.length; i++) {
    await prisma.player.update({
      where: { id: rankedPlayers[i].id },
      data: { rank: i + 1 }
    });
  }
  console.log('✅ Player rankings calculated\n');

  console.log('🎉 Database seed completed successfully!\n');
  console.log('📈 Summary:');
  console.log(`  - Players: ${players.length}`);
  console.log(`  - Matches: ${matchCount}`);
  console.log(`  - Top Player: ${rankedPlayers[0].username} (ELO: ${rankedPlayers[0].elo_rating})`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
