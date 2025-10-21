import { 
  Player, 
  PlayerStats, 
  PrivacyLevel,
  Match,
  MatchResult,
  MatchStatus,
  GameMode,
  DifficultyLevel,
  WeaponUsage,
  Leaderboard,
  LeaderboardEntry,
  LeaderboardScope,
  TimePeriod,
  SortCriteria
} from '../models';

import {
  randomInt,
  randomFloat,
  randomBoolean,
  randomDate,
  randomElement,
  randomSubset,
  randomUsername,
  randomCountryCode,
  randomMapName,
  randomWeaponName,
  randomEmail,
  randomId,
  randomKdRatio,
  randomPerformanceMetrics,
  randomWinRate,
  randomMatchStats,
  randomPerformanceTrend,
  randomAvatarUrl
} from './mockDataGenerators';

import { playerService, matchService, leaderboardService } from '../services';

// Constants for mock data generation
const NUM_PLAYERS = 100;
const NUM_MATCHES = 50;
const CURRENT_DATE = new Date();
const ONE_MONTH_AGO = new Date(CURRENT_DATE.getTime() - 30 * 24 * 60 * 60 * 1000);

/**
 * Generate mock players
 * @returns Array of mock players
 */
export function generateMockPlayers(count: number = NUM_PLAYERS): Player[] {
  const players: Player[] = [];
  
  for (let i = 0; i < count; i++) {
    const username = randomUsername() + randomInt(100, 999);
    const displayName = username;
    const countryCode = randomCountryCode();
    const skillLevel = randomFloat(0, 1, 2); // Random skill level between 0 and 1
    
    const player: Player = {
      id: randomId('player_'),
      username,
      email: randomEmail(username),
      displayName,
      countryCode,
      avatarUrl: randomAvatarUrl(username),
      createdAt: randomDate(new Date(2020, 0, 1), ONE_MONTH_AGO),
      lastLoginAt: randomDate(ONE_MONTH_AGO, CURRENT_DATE),
      isActive: randomBoolean(0.9),
      settings: {
        notifications: randomBoolean(0.7),
        privacy: randomElement([PrivacyLevel.PUBLIC, PrivacyLevel.FRIENDS_ONLY, PrivacyLevel.PRIVATE]),
        theme: randomElement(['light', 'dark', 'system']),
        language: randomElement(['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh'])
      }
    };
    
    // Add some friends (will be populated after all players are created)
    if (i > 0 && randomBoolean(0.8)) {
      player.friendIds = [];
    }
    
    players.push(player);
  }
  
  // Add friends
  players.forEach(player => {
    if (player.friendIds) {
      const numFriends = randomInt(1, 10);
      const potentialFriends = players.filter(p => p.id !== player.id);
      player.friendIds = randomSubset(potentialFriends.map(p => p.id), numFriends);
    }
  });
  
  return players;
}

/**
 * Generate mock player statistics
 * @param players Array of players to generate statistics for
 * @returns Array of mock player statistics
 */
export function generateMockPlayerStats(players: Player[]): PlayerStats[] {
  return players.map(player => {
    // Assign a random skill level to determine performance metrics
    const skillLevel = randomFloat(0, 1, 2);
    const metrics = randomPerformanceMetrics(skillLevel);
    const winRate = randomWinRate(skillLevel);
    
    // Calculate wins and losses based on win rate
    const matchesPlayed = randomInt(10, 200);
    const wins = Math.round(matchesPlayed * (winRate / 100));
    const losses = matchesPlayed - wins;
    
    // Generate random ranks
    const sessionRank = randomInt(1, 100);
    const countryRank = randomInt(1, 2000);
    const globalRank = randomInt(1, 10000);
    
    return {
      playerId: player.id,
      kills: metrics.kills,
      deaths: metrics.deaths,
      assists: randomInt(10, 200),
      kdRatio: metrics.kdRatio,
      matchesPlayed,
      wins,
      losses,
      winRate,
      favoriteWeapon: randomWeaponName(),
      weaponAccuracy: randomInt(30, 90),
      headshots: metrics.headshots,
      headshotRatio: randomFloat(0.1, 0.5, 2),
      accuracy: metrics.accuracy,
      averageScore: randomInt(1000, 10000),
      highestKillStreak: randomInt(3, 20),
      playtime: randomInt(60, 5000), // in minutes
      sessionRank,
      countryRank,
      globalRank,
      recentPerformance: randomPerformanceTrend(),
      lastUpdated: new Date()
    };
  });
}

/**
 * Generate mock matches
 * @returns Array of mock matches
 */
export function generateMockMatches(count: number = NUM_MATCHES): Match[] {
  const matches: Match[] = [];
  
  for (let i = 0; i < count; i++) {
    const gameMode = randomElement(Object.values(GameMode));
    const isTeamMode = gameMode !== GameMode.DEATHMATCH && gameMode !== GameMode.BATTLE_ROYALE;
    
    // Determine match status with a bias towards completed matches
    const statusRandom = Math.random();
    let status: MatchStatus;
    if (statusRandom < 0.8) {
      status = MatchStatus.COMPLETED;
    } else if (statusRandom < 0.9) {
      status = MatchStatus.IN_PROGRESS;
    } else {
      status = MatchStatus.PENDING;
    }
    
    const startTime = randomDate(ONE_MONTH_AGO, CURRENT_DATE);
    let endTime: Date | undefined;
    let duration: number | undefined;
    
    if (status === MatchStatus.COMPLETED) {
      const matchStats = randomMatchStats();
      duration = matchStats.duration;
      endTime = new Date(startTime.getTime() + duration * 1000);
    }
    
    const match: Match = {
      id: randomId('match_'),
      serverId: randomId('server_'),
      startTime,
      endTime,
      duration,
      mapName: randomMapName(),
      gameMode,
      status,
      maxPlayers: randomInt(8, 32),
      isRanked: randomBoolean(0.7),
      difficulty: randomElement(Object.values(DifficultyLevel)),
      playerCount: randomInt(8, 32),
      spectatorCount: randomInt(0, 10),
      winningTeam: status === MatchStatus.COMPLETED && isTeamMode ? 
        randomElement(['red', 'blue']) : 
        (status === MatchStatus.COMPLETED ? 'none' : undefined),
      mvpPlayerId: status === MatchStatus.COMPLETED ? randomId('player_') : undefined,
      tags: randomSubset(['featured', 'tournament', 'casual', 'ranked', 'special'], randomInt(0, 3)),
      version: '1.0.' + randomInt(0, 10)
    };
    
    matches.push(match);
  }
  
  return matches;
}

/**
 * Generate mock match results
 * @param matches Array of matches to generate results for
 * @param players Array of players to include in the results
 * @returns Map of match ID to array of match results
 */
export function generateMockMatchResults(
  matches: Match[], 
  players: Player[]
): Map<string, MatchResult[]> {
  const matchResults = new Map<string, MatchResult[]>();
  
  matches.forEach(match => {
    if (match.status !== MatchStatus.COMPLETED) {
      return;
    }
    
    // Determine number of players in this match
    const numPlayers = match.playerCount || randomInt(8, Math.min(32, players.length));
    
    // Select random players for this match
    const matchPlayers = randomSubset(players, numPlayers);
    
    // Generate results for each player
    const results: MatchResult[] = matchPlayers.map((player, index) => {
      const skillLevel = randomFloat(0, 1, 2);
      const metrics = randomPerformanceMetrics(skillLevel);
      
      // Determine team if applicable
      let team: 'red' | 'blue' | undefined;
      if (match.gameMode !== GameMode.DEATHMATCH && match.gameMode !== GameMode.BATTLE_ROYALE) {
        team = index % 2 === 0 ? 'red' : 'blue';
      }
      
      // Determine result based on winning team
      let result: 'win' | 'loss' | 'draw';
      if (match.winningTeam === 'none') {
        result = index === 0 ? 'win' : 'loss'; // First player wins in free-for-all
      } else if (team && match.winningTeam === team) {
        result = 'win';
      } else if (team && match.winningTeam !== team) {
        result = 'loss';
      } else {
        result = randomBoolean(0.5) ? 'win' : 'loss';
      }
      
      // Generate weapon usage
      const numWeapons = randomInt(1, 5);
      const weaponStats: WeaponUsage[] = [];
      
      for (let i = 0; i < numWeapons; i++) {
        const weaponName = randomWeaponName();
        const weaponKills = randomInt(0, metrics.kills);
        
        weaponStats.push({
          weaponId: randomId('weapon_'),
          weaponName,
          kills: weaponKills,
          headshots: randomInt(0, weaponKills),
          accuracy: randomInt(20, 90),
          timeUsed: randomInt(30, 600) // in seconds
        });
      }
      
      return {
        id: randomId('result_'),
        matchId: match.id,
        playerId: player.id,
        team,
        kills: metrics.kills,
        deaths: metrics.deaths,
        assists: randomInt(0, 20),
        kdRatio: metrics.kdRatio,
        score: randomInt(1000, 10000),
        headshots: metrics.headshots,
        accuracy: metrics.accuracy,
        result,
        achievements: randomBoolean(0.3) ? 
          randomSubset(['first_blood', 'double_kill', 'triple_kill', 'quadra_kill', 'penta_kill', 'ace'], randomInt(1, 3)) : 
          undefined,
        weaponStats,
        placement: index + 1,
        experienceGained: randomInt(100, 1000),
        joinedAt: match.startTime,
        leftAt: match.endTime
      };
    });
    
    matchResults.set(match.id, results);
  });
  
  return matchResults;
}

/**
 * Generate mock leaderboard entries
 * @param players Array of players to include in the leaderboard
 * @param playerStats Array of player statistics
 * @returns Array of leaderboard entries
 */
export function generateMockLeaderboardEntries(
  players: Player[],
  playerStats: PlayerStats[]
): LeaderboardEntry[] {
  // Create a map of player ID to stats for easy lookup
  const statsMap = new Map<string, PlayerStats>();
  playerStats.forEach(stats => statsMap.set(stats.playerId, stats));
  
  // Generate entries
  return players.map((player, index) => {
    const stats = statsMap.get(player.id);
    
    if (!stats) {
      throw new Error(`No stats found for player ${player.id}`);
    }
    
    // Calculate rank change
    const previousRank = randomInt(1, 100);
    const rankChange = previousRank - (index + 1);
    
    return {
      id: randomId('entry_'),
      playerId: player.id,
      leaderboardId: 'mock_leaderboard',
      playerName: player.displayName,
      countryCode: player.countryCode,
      rank: index + 1,
      previousRank,
      rankChange,
      kills: stats.kills,
      deaths: stats.deaths,
      kdRatio: stats.kdRatio,
      matchesPlayed: stats.matchesPlayed,
      wins: stats.wins,
      losses: stats.losses,
      winRate: stats.winRate,
      isOnWinStreak: randomBoolean(0.3),
      currentStreak: randomInt(0, 10),
      score: stats.averageScore,
      headshots: stats.headshots,
      accuracy: stats.accuracy,
      isFriend: randomBoolean(0.2),
      clanTag: randomBoolean(0.3) ? randomElement(['ELITE', 'PRO', 'TEAM', 'CLAN', 'SQUAD']) : undefined,
      lastPlayed: randomDate(ONE_MONTH_AGO, CURRENT_DATE)
    };
  });
}

/**
 * Generate mock leaderboards
 * @param players Array of players to include in the leaderboards
 * @param playerStats Array of player statistics
 * @returns Array of leaderboards
 */
export function generateMockLeaderboards(
  players: Player[],
  playerStats: PlayerStats[]
): Leaderboard[] {
  const leaderboards: Leaderboard[] = [];
  
  // Define scopes and time periods to create leaderboards for
  const scopes = Object.values(LeaderboardScope);
  const timePeriods = Object.values(TimePeriod);
  
  // Group players by country
  const countriesMap = new Map<string, Player[]>();
  players.forEach(player => {
    const countryPlayers = countriesMap.get(player.countryCode) || [];
    countriesMap.set(player.countryCode, [...countryPlayers, player]);
  });
  
  // Create leaderboards for each scope and time period
  scopes.forEach(scope => {
    timePeriods.forEach(timePeriod => {
      if (scope === LeaderboardScope.SESSION && timePeriod !== TimePeriod.SESSION) {
        // Skip invalid combinations
        return;
      }
      
      if (scope === LeaderboardScope.COUNTRY) {
        // Create a leaderboard for each country
        countriesMap.forEach((countryPlayers, countryCode) => {
          if (countryPlayers.length < 5) {
            // Skip countries with too few players
            return;
          }
          
          const id = `${scope}-${timePeriod}-${countryCode}`;
          const name = `${countryCode} Leaderboard - ${timePeriod}`;
          
          // Sort players by skill level (approximated by K/D ratio)
          const sortedPlayers = [...countryPlayers].sort((a, b) => {
            const statsA = playerStats.find(stats => stats.playerId === a.id);
            const statsB = playerStats.find(stats => stats.playerId === b.id);
            return (statsB?.kdRatio || 0) - (statsA?.kdRatio || 0);
          });
          
          // Generate entries for this leaderboard
          const entries = generateMockLeaderboardEntries(sortedPlayers, playerStats);
          
          leaderboards.push({
            id,
            name,
            description: `Top players from ${countryCode} for ${timePeriod}`,
            scope,
            timePeriod,
            sortBy: SortCriteria.RANK,
            sortDirection: 'asc',
            entries,
            totalPlayers: entries.length,
            lastUpdated: new Date()
          });
        });
      } else {
        // Create global or session leaderboard
        const id = `${scope}-${timePeriod}`;
        const name = `${scope} Leaderboard - ${timePeriod}`;
        
        // For global, use all players; for session, use a subset
        const leaderboardPlayers = scope === LeaderboardScope.SESSION ? 
          randomSubset(players, randomInt(10, 50)) : 
          players;
        
        // Sort players by skill level (approximated by K/D ratio)
        const sortedPlayers = [...leaderboardPlayers].sort((a, b) => {
          const statsA = playerStats.find(stats => stats.playerId === a.id);
          const statsB = playerStats.find(stats => stats.playerId === b.id);
          return (statsB?.kdRatio || 0) - (statsA?.kdRatio || 0);
        });
        
        // Generate entries for this leaderboard
        const entries = generateMockLeaderboardEntries(sortedPlayers, playerStats);
        
        leaderboards.push({
          id,
          name,
          description: `${scope} leaderboard for ${timePeriod}`,
          scope,
          timePeriod,
          sortBy: SortCriteria.RANK,
          sortDirection: 'asc',
          entries,
          totalPlayers: entries.length,
          lastUpdated: new Date()
        });
      }
    });
  });
  
  return leaderboards;
}

/**
 * Initialize all mock data
 */
export function initializeMockData(): void {
  // Generate players
  const players = generateMockPlayers();
  
  // Generate player stats
  const playerStats = generateMockPlayerStats(players);
  
  // Generate matches
  const matches = generateMockMatches();
  
  // Generate match results
  const matchResults = generateMockMatchResults(matches, players);
  
  // Generate leaderboards
  const leaderboards = generateMockLeaderboards(players, playerStats);
  
  // Initialize services with mock data
  playerService.initializeMockData(players, playerStats);
  matchService.initializeMockData(matches, matchResults);
  leaderboardService.initializeMockData(leaderboards);
  
  console.log('Mock data initialized:');
  console.log(`- ${players.length} players`);
  console.log(`- ${matches.length} matches`);
  console.log(`- ${leaderboards.length} leaderboards`);
}