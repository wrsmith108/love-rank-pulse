import { MatchResult, PlayerStats, WeaponUsage } from '../models';

/**
 * Calculate K/D ratio from kills and deaths
 * @param kills Number of kills
 * @param deaths Number of deaths
 * @returns K/D ratio
 */
export function calculateKdRatio(kills: number, deaths: number): number {
  if (deaths === 0) return kills; // Avoid division by zero
  return parseFloat((kills / deaths).toFixed(2));
}

/**
 * Calculate win rate from wins and losses
 * @param wins Number of wins
 * @param losses Number of losses
 * @returns Win rate percentage
 */
export function calculateWinRate(wins: number, losses: number): number {
  const total = wins + losses;
  if (total === 0) return 0;
  return Math.round((wins / total) * 100);
}

/**
 * Calculate headshot ratio from headshots and kills
 * @param headshots Number of headshots
 * @param kills Number of kills
 * @returns Headshot ratio percentage
 */
export function calculateHeadshotRatio(headshots: number, kills: number): number {
  if (kills === 0) return 0;
  return Math.round((headshots / kills) * 100);
}

/**
 * Calculate average score per match
 * @param totalScore Total score
 * @param matchesPlayed Number of matches played
 * @returns Average score per match
 */
export function calculateAverageScore(totalScore: number, matchesPlayed: number): number {
  if (matchesPlayed === 0) return 0;
  return Math.round(totalScore / matchesPlayed);
}

/**
 * Calculate average kills per match
 * @param kills Total kills
 * @param matchesPlayed Number of matches played
 * @returns Average kills per match
 */
export function calculateAverageKills(kills: number, matchesPlayed: number): number {
  if (matchesPlayed === 0) return 0;
  return parseFloat((kills / matchesPlayed).toFixed(2));
}

/**
 * Calculate average deaths per match
 * @param deaths Total deaths
 * @param matchesPlayed Number of matches played
 * @returns Average deaths per match
 */
export function calculateAverageDeaths(deaths: number, matchesPlayed: number): number {
  if (matchesPlayed === 0) return 0;
  return parseFloat((deaths / matchesPlayed).toFixed(2));
}

/**
 * Calculate performance trend based on recent match results
 * @param matchResults Array of match results, sorted by date (newest first)
 * @param recentCount Number of recent matches to consider
 * @returns Performance trend
 */
export function calculatePerformanceTrend(
  matchResults: MatchResult[],
  recentCount: number = 5
): 'improving' | 'steady' | 'declining' {
  if (matchResults.length < recentCount) {
    return 'steady'; // Not enough data
  }
  
  // Get recent and previous match results
  const recentMatches = matchResults.slice(0, recentCount);
  const previousMatches = matchResults.slice(recentCount, recentCount * 2);
  
  if (previousMatches.length === 0) {
    return 'steady'; // Not enough historical data
  }
  
  // Calculate average K/D for recent and previous matches
  const recentKdSum = recentMatches.reduce((sum, match) => sum + match.kdRatio, 0);
  const previousKdSum = previousMatches.reduce((sum, match) => sum + match.kdRatio, 0);
  
  const recentKdAvg = recentKdSum / recentMatches.length;
  const previousKdAvg = previousKdSum / previousMatches.length;
  
  // Calculate win rates for recent and previous matches
  const recentWins = recentMatches.filter(match => match.result === 'win').length;
  const previousWins = previousMatches.filter(match => match.result === 'win').length;
  
  const recentWinRate = recentWins / recentMatches.length;
  const previousWinRate = previousWins / previousMatches.length;
  
  // Calculate performance change
  const kdChange = recentKdAvg - previousKdAvg;
  const winRateChange = recentWinRate - previousWinRate;
  
  // Determine trend based on combined factors
  const combinedChange = kdChange * 2 + winRateChange * 3; // Weighted importance
  
  if (combinedChange > 0.2) {
    return 'improving';
  } else if (combinedChange < -0.2) {
    return 'declining';
  } else {
    return 'steady';
  }
}

/**
 * Find a player's favorite weapon based on usage statistics
 * @param weaponUsages Array of weapon usage statistics
 * @returns Favorite weapon name or undefined if no data
 */
export function findFavoriteWeapon(weaponUsages: WeaponUsage[]): string | undefined {
  if (weaponUsages.length === 0) return undefined;
  
  // Sort by kills (most kills first)
  const sortedByKills = [...weaponUsages].sort((a, b) => b.kills - a.kills);
  return sortedByKills[0].weaponName;
}

/**
 * Calculate weapon accuracy across all weapons
 * @param weaponUsages Array of weapon usage statistics
 * @returns Average accuracy percentage
 */
export function calculateOverallWeaponAccuracy(weaponUsages: WeaponUsage[]): number {
  if (weaponUsages.length === 0) return 0;
  
  const totalAccuracy = weaponUsages.reduce((sum, weapon) => sum + weapon.accuracy, 0);
  return Math.round(totalAccuracy / weaponUsages.length);
}

/**
 * Calculate highest kill streak from match results
 * @param matchResults Array of match results
 * @returns Highest kill streak
 */
export function calculateHighestKillStreak(matchResults: MatchResult[]): number {
  // This is a simplified version since we don't have actual kill streak data
  // In a real implementation, this would analyze detailed match data
  
  // For now, we'll estimate based on kills per match
  const highestKills = Math.max(...matchResults.map(result => result.kills));
  return Math.max(3, Math.round(highestKills * 0.4)); // Rough estimate
}

/**
 * Calculate total playtime from match results
 * @param matchResults Array of match results
 * @returns Total playtime in minutes
 */
export function calculateTotalPlaytime(matchResults: MatchResult[]): number {
  let totalMinutes = 0;
  
  matchResults.forEach(result => {
    if (result.joinedAt && result.leftAt) {
      const durationMs = result.leftAt.getTime() - result.joinedAt.getTime();
      totalMinutes += Math.round(durationMs / (1000 * 60));
    }
  });
  
  return totalMinutes;
}

/**
 * Calculate player statistics from match results
 * @param playerId Player ID
 * @param matchResults Array of match results for the player
 * @returns Player statistics
 */
export function calculatePlayerStats(
  playerId: string,
  matchResults: MatchResult[]
): Partial<PlayerStats> {
  if (matchResults.length === 0) {
    return {
      playerId,
      kills: 0,
      deaths: 0,
      assists: 0,
      kdRatio: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      headshots: 0,
      headshotRatio: 0,
      accuracy: 0,
      averageScore: 0,
      highestKillStreak: 0,
      playtime: 0,
      recentPerformance: 'steady',
      lastUpdated: new Date()
    };
  }
  
  // Calculate basic stats
  const kills = matchResults.reduce((sum, match) => sum + match.kills, 0);
  const deaths = matchResults.reduce((sum, match) => sum + match.deaths, 0);
  const assists = matchResults.reduce((sum, match) => sum + match.assists, 0);
  const kdRatio = calculateKdRatio(kills, deaths);
  
  // Calculate match outcomes
  const wins = matchResults.filter(match => match.result === 'win').length;
  const losses = matchResults.filter(match => match.result === 'loss').length;
  const winRate = calculateWinRate(wins, losses);
  
  // Calculate headshots
  const headshots = matchResults.reduce((sum, match) => sum + match.headshots, 0);
  const headshotRatio = calculateHeadshotRatio(headshots, kills);
  
  // Calculate accuracy
  const totalAccuracy = matchResults.reduce((sum, match) => sum + match.accuracy, 0);
  const accuracy = Math.round(totalAccuracy / matchResults.length);
  
  // Calculate score
  const totalScore = matchResults.reduce((sum, match) => sum + match.score, 0);
  const averageScore = calculateAverageScore(totalScore, matchResults.length);
  
  // Calculate performance trend
  const recentPerformance = calculatePerformanceTrend(matchResults);
  
  // Calculate highest kill streak
  const highestKillStreak = calculateHighestKillStreak(matchResults);
  
  // Calculate playtime
  const playtime = calculateTotalPlaytime(matchResults);
  
  // Collect all weapon usages
  const allWeaponUsages: WeaponUsage[] = [];
  matchResults.forEach(match => {
    if (match.weaponStats) {
      allWeaponUsages.push(...match.weaponStats);
    }
  });
  
  // Find favorite weapon
  const favoriteWeapon = findFavoriteWeapon(allWeaponUsages);
  
  // Calculate weapon accuracy
  const weaponAccuracy = calculateOverallWeaponAccuracy(allWeaponUsages);
  
  return {
    playerId,
    kills,
    deaths,
    assists,
    kdRatio,
    matchesPlayed: matchResults.length,
    wins,
    losses,
    winRate,
    favoriteWeapon,
    weaponAccuracy,
    headshots,
    headshotRatio,
    accuracy,
    averageScore,
    highestKillStreak,
    playtime,
    recentPerformance,
    lastUpdated: new Date()
  };
}

/**
 * Compare player statistics to determine relative skill level
 * @param playerStats Player statistics to compare
 * @param averageStats Average statistics for comparison
 * @returns Object with relative skill metrics
 */
export function comparePlayerStats(
  playerStats: PlayerStats,
  averageStats: PlayerStats
): {
  kdRatioPercentile: number;
  winRatePercentile: number;
  accuracyPercentile: number;
  overallPercentile: number;
} {
  // Calculate percentiles (simplified)
  // In a real implementation, this would use actual percentile calculations
  
  const kdRatioPercentile = Math.min(100, Math.round((playerStats.kdRatio / averageStats.kdRatio) * 50));
  const winRatePercentile = Math.min(100, Math.round((playerStats.winRate / averageStats.winRate) * 50));
  const accuracyPercentile = Math.min(100, Math.round((playerStats.accuracy / averageStats.accuracy) * 50));
  
  // Calculate overall percentile as weighted average
  const overallPercentile = Math.round(
    (kdRatioPercentile * 0.4) + (winRatePercentile * 0.4) + (accuracyPercentile * 0.2)
  );
  
  return {
    kdRatioPercentile,
    winRatePercentile,
    accuracyPercentile,
    overallPercentile
  };
}