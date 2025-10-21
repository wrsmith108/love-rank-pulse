/**
 * Leaderboard model for the Love Rank Pulse system
 */
export interface Leaderboard {
  // Core identifiers
  id: string;
  
  // Leaderboard metadata
  name: string;
  description?: string;
  
  // Leaderboard scope and filtering
  scope: LeaderboardScope;
  timePeriod: TimePeriod;
  gameMode?: string;
  
  // Leaderboard configuration
  sortBy: SortCriteria;
  sortDirection: 'asc' | 'desc';
  
  // Leaderboard data
  entries: LeaderboardEntry[];
  
  // Pagination and metadata
  totalPlayers: number;
  lastUpdated: Date;
}

/**
 * Scope of the leaderboard
 */
export enum LeaderboardScope {
  SESSION = 'session',
  COUNTRY = 'country',
  GLOBAL = 'global'
}

/**
 * Time period for leaderboard data
 */
export enum TimePeriod {
  SESSION = 'session',
  HOUR = 'hour',
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  ALL_TIME = 'all'
}

/**
 * Criteria for sorting leaderboard entries
 */
export enum SortCriteria {
  RANK = 'rank',
  KD_RATIO = 'kd',
  KILLS = 'kills',
  WINS = 'wins',
  SCORE = 'score',
  ACCURACY = 'accuracy',
  HEADSHOTS = 'headshots'
}

/**
 * Leaderboard Entry model for aggregated player statistics
 */
export interface LeaderboardEntry {
  // Core identifiers
  id: string;
  playerId: string;
  leaderboardId: string;
  
  // Player information
  playerName: string;
  countryCode: string;
  
  // Ranking information
  rank: number;
  previousRank?: number;
  rankChange?: number; // positive for improvement, negative for decline
  
  // Core statistics
  kills: number;
  deaths: number;
  kdRatio: number;
  
  // Match performance
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  isOnWinStreak: boolean;
  currentStreak: number;
  
  // Additional performance metrics
  score: number;
  headshots: number;
  accuracy: number;
  
  // Social indicators
  isFriend?: boolean;
  clanTag?: string;
  
  // Timestamps
  lastPlayed: Date;
}

/**
 * Leaderboard filter options
 */
export interface LeaderboardFilter {
  scope?: LeaderboardScope;
  timePeriod?: TimePeriod;
  gameMode?: string;
  countryCode?: string;
  friendsOnly?: boolean;
  sortBy?: SortCriteria;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Leaderboard summary statistics
 */
export interface LeaderboardStats {
  totalPlayers: number;
  averageKdRatio: number;
  averageAccuracy: number;
  averageScore: number;
  topCountries: CountryStats[];
  mostPopularWeapon: string;
}

/**
 * Country statistics for leaderboards
 */
export interface CountryStats {
  countryCode: string;
  playerCount: number;
  averageRank: number;
  topPlayerName: string;
  topPlayerRank: number;
}