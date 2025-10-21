import {
  Player,
  PlayerStats,
  Match,
  MatchResult,
  Leaderboard,
  LeaderboardEntry,
  GameMode,
  MatchStatus,
  DifficultyLevel,
  LeaderboardScope,
  TimePeriod,
  SortCriteria,
  WeaponUsage
} from '../../models';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a random string of specified length
 * @param length Length of the string to generate
 * @returns Random string
 */
export function randomString(length: number = 8): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param min Minimum value
 * @param max Maximum value
 * @returns Random integer
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float between min and max with specified precision
 * @param min Minimum value
 * @param max Maximum value
 * @param precision Number of decimal places
 * @returns Random float
 */
export function randomFloat(min: number, max: number, precision: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(precision));
}

/**
 * Generate a random date between start and end
 * @param start Start date
 * @param end End date
 * @returns Random date
 */
export function randomDate(start: Date = new Date(2020, 0, 1), end: Date = new Date()): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate a random country code
 * @returns Random country code
 */
export function randomCountryCode(): string {
  const countryCodes = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'BR', 'RU', 'CN', 'IN', 'ES', 'IT', 'NL', 'SE'];
  return countryCodes[randomInt(0, countryCodes.length - 1)];
}

/**
 * Generate a random player
 * @param overrides Properties to override in the generated player
 * @returns Random player
 */
export function generatePlayer(overrides: Partial<Player> = {}): Player {
  const id = overrides.id || uuidv4();
  const username = overrides.username || `user_${randomString(6)}`;
  
  return {
    id,
    username,
    email: overrides.email || `${username}@example.com`,
    displayName: overrides.displayName || username,
    countryCode: overrides.countryCode || randomCountryCode(),
    avatarUrl: overrides.avatarUrl,
    createdAt: overrides.createdAt || randomDate(new Date(2020, 0, 1), new Date(2023, 0, 1)),
    lastLoginAt: overrides.lastLoginAt || randomDate(new Date(2023, 0, 1)),
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    friendIds: overrides.friendIds,
    clanId: overrides.clanId,
    settings: overrides.settings,
  };
}

/**
 * Generate random player stats
 * @param playerId Player ID
 * @param overrides Properties to override in the generated stats
 * @returns Random player stats
 */
export function generatePlayerStats(playerId: string, overrides: Partial<PlayerStats> = {}): PlayerStats {
  const kills = overrides.kills || randomInt(50, 1000);
  const deaths = overrides.deaths || randomInt(20, 500);
  const kdRatio = overrides.kdRatio || Number((kills / Math.max(deaths, 1)).toFixed(2));
  const matchesPlayed = overrides.matchesPlayed || randomInt(10, 200);
  const wins = overrides.wins || randomInt(0, matchesPlayed);
  const losses = overrides.losses || (matchesPlayed - wins);
  const winRate = overrides.winRate || Number(((wins / matchesPlayed) * 100).toFixed(1));
  const headshots = overrides.headshots || randomInt(10, kills);
  const headshotRatio = overrides.headshotRatio || Number(((headshots / kills) * 100).toFixed(1));
  
  return {
    playerId,
    kills,
    deaths,
    assists: overrides.assists || randomInt(10, 500),
    kdRatio,
    matchesPlayed,
    wins,
    losses,
    winRate,
    favoriteWeapon: overrides.favoriteWeapon,
    weaponAccuracy: overrides.weaponAccuracy,
    headshots,
    headshotRatio,
    accuracy: overrides.accuracy || randomInt(30, 95),
    averageScore: overrides.averageScore || randomInt(1000, 5000),
    highestKillStreak: overrides.highestKillStreak || randomInt(5, 20),
    playtime: overrides.playtime || randomInt(60, 10000),
    sessionRank: overrides.sessionRank,
    countryRank: overrides.countryRank,
    globalRank: overrides.globalRank,
    recentPerformance: overrides.recentPerformance || 'steady',
    lastUpdated: overrides.lastUpdated || new Date(),
  };
}

/**
 * Generate a random match
 * @param overrides Properties to override in the generated match
 * @returns Random match
 */
export function generateMatch(overrides: Partial<Match> = {}): Match {
  const id = overrides.id || uuidv4();
  const startTime = overrides.startTime || randomDate(new Date(2023, 0, 1));
  const duration = overrides.duration || randomInt(300, 1800); // 5-30 minutes
  const endTime = overrides.endTime || new Date(startTime.getTime() + duration * 1000);
  
  return {
    id,
    serverId: overrides.serverId || `server_${randomString(4)}`,
    mapName: overrides.mapName || `Map ${randomString(4)}`,
    gameMode: overrides.gameMode || GameMode.DEATHMATCH,
    difficulty: overrides.difficulty || DifficultyLevel.NORMAL,
    status: overrides.status || MatchStatus.COMPLETED,
    startTime,
    endTime,
    duration,
    maxPlayers: overrides.maxPlayers || 32,
    isRanked: overrides.isRanked !== undefined ? overrides.isRanked : true,
    playerCount: overrides.playerCount || randomInt(8, 32),
    spectatorCount: overrides.spectatorCount || randomInt(0, 10),
    winningTeam: overrides.winningTeam,
    mvpPlayerId: overrides.mvpPlayerId,
    tags: overrides.tags,
    version: overrides.version || '1.0.0',
  };
}

/**
 * Generate a random match result
 * @param matchId Match ID
 * @param playerId Player ID
 * @param overrides Properties to override in the generated result
 * @returns Random match result
 */
export function generateMatchResult(
  matchId: string,
  playerId: string,
  overrides: Partial<MatchResult> = {}
): MatchResult {
  const id = overrides.id || uuidv4();
  const kills = overrides.kills || randomInt(0, 30);
  const deaths = overrides.deaths || randomInt(0, 20);
  const kdRatio = overrides.kdRatio || Number((kills / Math.max(deaths, 1)).toFixed(2));
  const joinedAt = overrides.joinedAt || new Date();
  const leftAt = overrides.leftAt || new Date(joinedAt.getTime() + randomInt(300, 1800) * 1000);
  
  return {
    id,
    matchId,
    playerId,
    team: overrides.team || (Math.random() > 0.5 ? 'red' : 'blue'),
    kills,
    deaths,
    assists: overrides.assists || randomInt(0, 15),
    kdRatio,
    score: overrides.score || randomInt(500, 5000),
    headshots: overrides.headshots || randomInt(0, kills),
    accuracy: overrides.accuracy || randomInt(30, 95),
    result: overrides.result || (Math.random() > 0.5 ? 'win' : 'loss'),
    achievements: overrides.achievements,
    weaponStats: overrides.weaponStats,
    placement: overrides.placement || randomInt(1, 10),
    experienceGained: overrides.experienceGained || randomInt(100, 1000),
    joinedAt,
    leftAt
  };
}

/**
 * Generate a random leaderboard entry
 * @param playerId Player ID
 * @param playerName Player name
 * @param rank Rank
 * @param overrides Properties to override in the generated entry
 * @returns Random leaderboard entry
 */
export function generateLeaderboardEntry(
  playerId: string,
  playerName: string,
  rank: number,
  leaderboardId: string,
  overrides: Partial<LeaderboardEntry> = {}
): LeaderboardEntry {
  const id = overrides.id || uuidv4();
  const kills = overrides.kills || randomInt(50, 1000);
  const deaths = overrides.deaths || randomInt(20, 500);
  const kdRatio = overrides.kdRatio || Number((kills / Math.max(deaths, 1)).toFixed(2));
  const matchesPlayed = overrides.matchesPlayed || randomInt(10, 200);
  const wins = overrides.wins || randomInt(0, matchesPlayed);
  const losses = overrides.losses || (matchesPlayed - wins);
  const winRate = overrides.winRate || Number(((wins / matchesPlayed) * 100).toFixed(1));
  const currentStreak = overrides.currentStreak || randomInt(0, 10);
  const isOnWinStreak = overrides.isOnWinStreak !== undefined ? overrides.isOnWinStreak : currentStreak > 0;
  
  return {
    id,
    playerId,
    leaderboardId,
    playerName,
    countryCode: overrides.countryCode || randomCountryCode(),
    rank,
    previousRank: overrides.previousRank,
    rankChange: overrides.rankChange,
    kills,
    deaths,
    kdRatio,
    matchesPlayed,
    wins,
    losses,
    winRate,
    isOnWinStreak,
    currentStreak,
    score: overrides.score || randomInt(1000, 10000),
    headshots: overrides.headshots || randomInt(10, kills),
    accuracy: overrides.accuracy || randomInt(30, 95),
    isFriend: overrides.isFriend,
    clanTag: overrides.clanTag,
    lastPlayed: overrides.lastPlayed || new Date()
  };
}

/**
 * Generate a random leaderboard
 * @param scope Leaderboard scope
 * @param timePeriod Time period
 * @param entryCount Number of entries to generate
 * @param overrides Properties to override in the generated leaderboard
 * @returns Random leaderboard
 */
export function generateLeaderboard(
  scope: LeaderboardScope,
  timePeriod: TimePeriod,
  entryCount: number = 10,
  overrides: Partial<Leaderboard> = {}
): Leaderboard {
  const id = overrides.id || `${scope}-${timePeriod}-${randomString(4)}`;
  const entries: LeaderboardEntry[] = [];
  
  for (let i = 0; i < entryCount; i++) {
    const playerId = uuidv4();
    const playerName = `Player${i + 1}`;
    entries.push(generateLeaderboardEntry(playerId, playerName, i + 1, id));
  }
  
  return {
    id,
    name: overrides.name || `${scope} Leaderboard - ${timePeriod}`,
    description: overrides.description,
    scope: overrides.scope || scope,
    timePeriod: overrides.timePeriod || timePeriod,
    gameMode: overrides.gameMode,
    sortBy: overrides.sortBy || SortCriteria.RANK,
    sortDirection: overrides.sortDirection || 'asc',
    entries: overrides.entries || entries,
    totalPlayers: overrides.totalPlayers || entryCount,
    lastUpdated: overrides.lastUpdated || new Date(),
  };
}