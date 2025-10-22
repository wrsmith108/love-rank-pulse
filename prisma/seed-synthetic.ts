import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding synthetic data for MVP...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.matchResult.deleteMany();
  await prisma.match.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.player.deleteMany();

  // Create 50 test players
  console.log('Creating 50 test players...');
  const players = [];
  for (let i = 1; i <= 50; i++) {
    const eloRating = 1200 + Math.floor(Math.random() * 800);
    players.push({
      username: `player${i}`,
      email: `player${i}@test.com`,
      password_hash: '$2b$10$dummyHashForMVPTesting', // Not real auth for MVP
      elo_rating: eloRating,
      peakElo: eloRating + Math.floor(Math.random() * 100),
      lowestElo: eloRating - Math.floor(Math.random() * 100),
      country_code: ['US', 'UK', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'BR', 'JP'][i % 10],
      bio: `Test player ${i} - MVP synthetic data`,
      is_active: true,
      is_verified: true,
      matches_played: Math.floor(Math.random() * 50),
      wins: Math.floor(Math.random() * 25),
      losses: Math.floor(Math.random() * 25),
      draws: Math.floor(Math.random() * 5),
    });
  }

  const createdPlayers = await Promise.all(
    players.map(player => prisma.player.create({ data: player }))
  );

  console.log(`✅ Created ${createdPlayers.length} players`);

  // Create 100 synthetic matches with results
  console.log('Creating 100 synthetic matches...');
  const matchesCreated = [];

  for (let i = 0; i < 100; i++) {
    const p1Index = Math.floor(Math.random() * 50);
    let p2Index = Math.floor(Math.random() * 50);
    while (p2Index === p1Index) {
      p2Index = Math.floor(Math.random() * 50);
    }

    const player1 = createdPlayers[p1Index];
    const player2 = createdPlayers[p2Index];

    // Determine winner based on ELO (higher ELO has better chance)
    const p1WinChance = 1 / (1 + Math.pow(10, (player2.elo_rating - player1.elo_rating) / 400));
    const isPlayer1Winner = Math.random() < p1WinChance;
    const isDraw = Math.random() < 0.1; // 10% chance of draw

    const winnerId = isDraw ? null : (isPlayer1Winner ? player1.id : player2.id);
    const loserId = isDraw ? null : (isPlayer1Winner ? player2.id : player1.id);

    const player1Score = isDraw ? 1 : (isPlayer1Winner ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 2));
    const player2Score = isDraw ? 1 : (isPlayer1Winner ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 3) + 2);

    const startedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const completedAt = new Date(startedAt.getTime() + Math.random() * 3600 * 1000);

    const match = await prisma.match.create({
      data: {
        player1_id: player1.id,
        player2_id: player2.id,
        status: 'COMPLETED',
        match_type: Math.random() > 0.2 ? 'RANKED' : 'FRIENDLY',
        started_at: startedAt,
        completed_at: completedAt,
      },
    });

    // Calculate ELO change (simplified K=32)
    const ratingChange = isDraw ? 0 : Math.floor(Math.random() * 30) + 10;

    await prisma.matchResult.create({
      data: {
        match_id: match.id,
        winner_id: winnerId,
        loser_id: loserId,
        result_type: isDraw ? 'DRAW' : 'WIN',
        player1_score: player1Score,
        player2_score: player2Score,
        rating_change: ratingChange,
        winner_new_elo: winnerId ? (winnerId === player1.id ? player1.elo_rating + ratingChange : player2.elo_rating + ratingChange) : null,
        loser_new_elo: loserId ? (loserId === player1.id ? player1.elo_rating - ratingChange : player2.elo_rating - ratingChange) : null,
        k_factor: 32,
        verification_status: 'VERIFIED',
        verified_at: completedAt,
      },
    });

    matchesCreated.push(match);
  }

  console.log(`✅ Created ${matchesCreated.length} matches with results`);

  // Create leaderboard entries for all players
  console.log('Creating leaderboard entries...');
  const sortedPlayers = createdPlayers
    .sort((a, b) => b.elo_rating - a.elo_rating)
    .map((player, index) => ({
      player_id: player.id,
      rank: index + 1,
      previous_rank: index + 1 + Math.floor(Math.random() * 5) - 2, // Some variation
      rank_change: Math.floor(Math.random() * 3) - 1,
      elo_rating: player.elo_rating,
      previous_elo: player.elo_rating - Math.floor(Math.random() * 50),
      peak_elo: player.peakElo,
      lowest_elo: player.lowestElo,
      matches_played: player.matches_played,
      wins: player.wins,
      losses: player.losses,
      draws: player.draws,
      win_rate: player.matches_played > 0 ? player.wins / player.matches_played : 0,
      current_streak: Math.floor(Math.random() * 10) - 5,
      best_win_streak: Math.floor(Math.random() * 8),
      leaderboard_type: 'GLOBAL',
      is_active: true,
      last_match_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    }));

  await Promise.all(
    sortedPlayers.map(entry => prisma.leaderboardEntry.create({ data: entry }))
  );

  console.log(`✅ Created ${sortedPlayers.length} leaderboard entries`);

  // Summary
  console.log('\n📊 Synthetic Data Summary:');
  console.log(`   Players: ${createdPlayers.length}`);
  console.log(`   Matches: ${matchesCreated.length}`);
  console.log(`   Match Results: ${matchesCreated.length}`);
  console.log(`   Leaderboard Entries: ${sortedPlayers.length}`);
  console.log('\n✅ Synthetic data created successfully!');
  console.log('\n🔍 Next steps:');
  console.log('   1. Run: npx prisma studio');
  console.log('   2. View your data in the browser');
  console.log('   3. Deploy to Vercel!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
