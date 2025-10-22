/**
 * Player model representing a user in the Love Rank Pulse system
 */
export interface Player {
  // Core identifiers
  id: string;
  username: string;
  email: string;

  // Profile information
  displayName: string;
  countryCode: string;
  avatarUrl?: string;
  bio?: string;

  // ELO Rating System
  eloRating: number;
  rank: number;

  // Account metadata
  createdAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
  isVerified?: boolean;

  // Social features
  friendIds?: string[];
  clanId?: string;

  // Preferences
  settings?: PlayerSettings;
}

/**
 * Player settings and preferences
 */
export interface PlayerSettings {
  notifications: boolean;
  privacy: PrivacyLevel;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

/**
 * Privacy level for player profiles
 */
export enum PrivacyLevel {
  PUBLIC = 'public',
  FRIENDS_ONLY = 'friends_only',
  PRIVATE = 'private'
}

/**
 * Player statistics aggregated across all matches
 */
export interface PlayerStats {
  playerId: string;

  // Core stats
  kills?: number;
  deaths?: number;
  assists?: number;
  kdRatio?: number;

  // Match results
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws?: number;
  winRate: number;

  // Streaks
  currentStreak?: number;
  bestStreak?: number;

  // Weapon stats
  favoriteWeapon?: string;
  weaponAccuracy?: number;
  headshots?: number;
  headshotRatio?: number;

  // Performance metrics
  accuracy?: number;
  averageScore: number;
  totalScore?: number;
  highestKillStreak?: number;
  playtime?: number; // in minutes

  // Ranking information
  rank: number;
  eloRating: number;
  peakElo?: number;
  lowestElo?: number;
  sessionRank?: number;
  countryRank?: number;
  globalRank?: number;

  // Trend analysis
  recentPerformance?: 'improving' | 'steady' | 'declining';

  // Last updated timestamp
  lastUpdated?: Date;
}