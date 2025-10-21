/**
 * Match model representing a game session in the Love Rank Pulse system
 */
export interface Match {
  // Core identifiers
  id: string;
  serverId: string;
  
  // Match metadata
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds
  
  // Match details
  mapName: string;
  gameMode: GameMode;
  status: MatchStatus;
  
  // Match configuration
  maxPlayers: number;
  isRanked: boolean;
  difficulty?: DifficultyLevel;
  
  // Match statistics
  playerCount: number;
  spectatorCount?: number;
  averagePlayerLevel?: number;
  
  // Results (populated when match is completed)
  winningTeam?: 'red' | 'blue' | 'none'; // 'none' for free-for-all
  mvpPlayerId?: string;
  
  // Additional metadata
  tags?: string[];
  version: string;
}

/**
 * Game modes available in the system
 */
export enum GameMode {
  DEATHMATCH = 'deathmatch',
  TEAM_DEATHMATCH = 'team_deathmatch',
  CAPTURE_THE_FLAG = 'capture_the_flag',
  DOMINATION = 'domination',
  BATTLE_ROYALE = 'battle_royale'
}

/**
 * Current status of a match
 */
export enum MatchStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

/**
 * Difficulty levels for matches
 */
export enum DifficultyLevel {
  CASUAL = 'casual',
  NORMAL = 'normal',
  COMPETITIVE = 'competitive',
  PROFESSIONAL = 'professional'
}

/**
 * Match Result model for individual player performance in a match
 */
export interface MatchResult {
  // Core identifiers
  id: string;
  matchId: string;
  playerId: string;
  
  // Team assignment
  team?: 'red' | 'blue'; // null for free-for-all
  
  // Core performance metrics
  kills: number;
  deaths: number;
  assists: number;
  kdRatio: number;
  
  // Additional performance metrics
  score: number;
  headshots: number;
  accuracy: number; // percentage
  
  // Match outcome for this player
  result: 'win' | 'loss' | 'draw';
  
  // Achievements earned in this match
  achievements?: string[];
  
  // Weapon usage statistics
  weaponStats?: WeaponUsage[];
  
  // Player position at end of match (ranking)
  placement: number;
  
  // XP and rewards
  experienceGained: number;
  
  // Timestamps
  joinedAt: Date;
  leftAt?: Date;
}

/**
 * Weapon usage statistics for a player in a match
 */
export interface WeaponUsage {
  weaponId: string;
  weaponName: string;
  kills: number;
  headshots: number;
  accuracy: number; // percentage
  timeUsed: number; // in seconds
}